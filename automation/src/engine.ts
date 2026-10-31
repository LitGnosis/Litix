import {Prisma, type DispatchAttempt, type SubOrder} from "@prisma/client";
import {db} from "./db.js";
import {add,status,requestCancellation,RejectedOrder,balanceCents,notifyAlert} from "./provider.js";

const enabled=()=>process.env.LITIX_WARRIOR_DISPATCH_ENABLED==="true";
const done=["COMPLETED","PARTIAL","CANCELED","REJECTED"];
const bound=(n:number,max:number)=>Math.max(0,Math.min(n,max));

export async function routeFor(s:SubOrder) {
  const used=await db.dispatchAttempt.findMany({where:{subOrderId:s.id},select:{supplierId:true}});
  return db.supplierRoute.findFirst({
    where:{enabled:true,platform:s.platform,kind:s.kind,
      minQty:{lte:s.remaining},maxQty:{gte:s.remaining},
      supplierId:{notIn:[...new Set(used.map(a=>a.supplierId))]},
      supplier:{approved:true,state:"ACTIVE",walletBalanceCents:{gte:5000},
        OR:[{circuitUntil:null},{circuitUntil:{lt:new Date()}}]}},
    include:{supplier:true},orderBy:[{priority:"asc"},{id:"asc"}]
  });
}
export async function aggregate(masterId:string) {
  const children=await db.subOrder.findMany({where:{masterId},select:{state:true}});
  const review=children.some(c=>["NEEDS_REVIEW","UNKNOWN_OUTCOME"].includes(c.state));
  const all=children.length>0&&children.every(c=>["COMPLETED","REFUNDED"].includes(c.state));
  await db.masterOrder.update({where:{id:masterId},
    data:{state:review?"NEEDS_REVIEW":all?(children.some(c=>c.state==="REFUNDED")?"PARTIAL":"COMPLETED"):"PROCESSING"}});
}
async function review(s:SubOrder,reason:string) {
  await db.subOrder.update({where:{id:s.id},data:{state:"NEEDS_REVIEW"}});
  await aggregate(s.masterId);
  await notifyAlert(reason,{subOrder:s.id}).catch(()=>{});
}
export async function dispatch(id:string) {
  if(!enabled())return "DISABLED";
  const sub=await db.subOrder.findUnique({where:{id}});
  if(!sub||sub.state!=="QUEUED")return "ALREADY_CLAIMED";
  const route=await routeFor(sub);
  if(!route){await review(sub,"NO_APPROVED_ROUTE");return "NEEDS_REVIEW";}
  const attempt=await db.$transaction(async tx=>{
    const claimed=await tx.subOrder.updateMany({where:{id,state:"QUEUED",remaining:sub.remaining},
      data:{state:"DISPATCHING",supplierId:route.supplierId,leaseUntil:new Date(Date.now()+60000)}});
    if(!claimed.count)return null;
    return tx.dispatchAttempt.create({data:{subOrderId:id,supplierId:route.supplierId,
      serviceId:route.serviceId,requested:sub.remaining,remaining:sub.remaining}});
  });
  if(!attempt)return "ALREADY_CLAIMED";
  try{
    const apiOrderId=await add(route.supplier,route.serviceId,sub.link,sub.remaining);
    await db.$transaction([
      db.dispatchAttempt.update({where:{id:attempt.id},data:{apiOrderId,state:"SUBMITTED",lastCheckedAt:new Date()}}),
      db.subOrder.update({where:{id},data:{apiOrderId,state:"SUBMITTED",
        lastProgressAt:new Date(),leaseUntil:null}})
    ]);
    return "SUBMITTED";
  }catch(e){
    // Unknown HTTP outcomes NEVER automatically replay. Supplier may have accepted the charge.
    const rejected=e instanceof RejectedOrder;
    await db.$transaction([
      db.dispatchAttempt.updateMany({where:{id:attempt.id,state:"DISPATCHING"},
        data:{state:rejected?"REJECTED":"UNKNOWN_OUTCOME",lastError:rejected?"REJECTED":"AMBIGUOUS"}}),
      db.subOrder.updateMany({where:{id,state:"DISPATCHING"},
        data:{state:rejected?"QUEUED":"UNKNOWN_OUTCOME",leaseUntil:null}})
    ]).catch(()=>{});
    if(rejected) {
      const refreshed=await db.subOrder.findUnique({where:{id}});
      if(refreshed&&!(await routeFor(refreshed)))await review(refreshed,"ALL_ROUTES_REJECTED");
    }else await notifyAlert("UNKNOWN_SUPPLIER_ACCEPTANCE",{subOrder:id}).catch(()=>{});
    await aggregate(sub.masterId);
    return rejected?"REJECTED":"UNKNOWN_OUTCOME";
  }
}
export async function dispatchQueue(limit=24) {
  if(!enabled())return 0;
  const rows=await db.subOrder.findMany({where:{state:"QUEUED"},
    orderBy:{createdAt:"asc"},take:Math.min(48,Math.max(1,limit)),select:{id:true}});
  for(let i=0;i<rows.length;i+=4)
    await Promise.allSettled(rows.slice(i,i+4).map(r=>dispatch(r.id)));
  return rows.length;
}
async function credit(sub:SubOrder) {
  const delta=bound(sub.quantity-sub.delivered,sub.quantity);
  const cents=bound(Math.round(sub.retailShareCents*delta/sub.quantity),sub.retailShareCents);
  const key="shortfall/"+sub.id;
  try{
    await db.$transaction(async tx=>{
      if(await tx.walletCredit.findUnique({where:{idempotencyKey:key}}))return;
      const owner=await tx.masterOrder.findUniqueOrThrow({where:{id:sub.masterId}});
      await tx.walletAccount.upsert({where:{customerId:owner.customerId},
        create:{customerId:owner.customerId,balanceCents:cents},
        update:{balanceCents:{increment:cents}}});
      await tx.walletCredit.create({data:{customerId:owner.customerId,subOrderId:sub.id,
        amountCents:cents,idempotencyKey:key}});
      await tx.subOrder.update({where:{id:sub.id},data:{state:"REFUNDED"}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(e){
    if(!(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002"))throw e;
  }
  await aggregate(sub.masterId);
}
function normalize(v:string) {
  const x=v.trim().toLowerCase().replace(/[_-]/g," ");
  if(x==="completed")return "COMPLETED";
  if(x==="partial")return "PARTIAL";
  if(["cancelled","canceled","failed"].includes(x))return "CANCELED";
  if(["processing","in progress"].includes(x))return "PROCESSING";
  if(["pending","queued","awaiting"].includes(x))return "PENDING";
  return "UNKNOWN";
}
async function terminal(a:DispatchAttempt,s:SubOrder,label:string,delivered:number,remains:number) {
  const delta=Math.max(0,delivered-a.delivered);
  const committed=await db.$transaction(async tx=>{
    const c=await tx.dispatchAttempt.updateMany({where:{id:a.id,delivered:a.delivered,
      state:{notIn:["COMPLETED","PARTIAL","CANCELED","REJECTED"]}},
      data:{delivered,remaining:remains,state:label as "COMPLETED"|"PARTIAL"|"CANCELED",lastCheckedAt:new Date()}});
    if(!c.count)return false;
    await tx.subOrder.update({where:{id:s.id},
      data:{delivered:{increment:delta},remaining:{decrement:delta},state:"NEEDS_REVIEW",
        leaseUntil:null,lastProgressAt:delta?new Date():s.lastProgressAt}});
    return true;
  });
  if(!committed)return;
  const latest=await db.subOrder.findUniqueOrThrow({where:{id:s.id}});
  if(latest.remaining===0)await db.subOrder.update({where:{id:s.id},data:{state:"COMPLETED"}});
  else if(label==="CANCELED"){
    if(await routeFor(latest))await db.subOrder.update({where:{id:s.id},
      data:{state:"QUEUED",supplierId:null,apiOrderId:null,cancelRequestedAt:null}});
    else await credit(latest);
  }else if(label==="PARTIAL")await credit(latest);
  else await review(latest,"COMPLETED_WITH_REMAINDER");
  await aggregate(s.masterId);
}
export async function poll(id:string) {
  const attempt=await db.dispatchAttempt.findUnique({where:{id},
    include:{supplier:true,subOrder:true}});
  if(!attempt||!attempt.apiOrderId||done.includes(attempt.state))return;
  const result=await status(attempt.supplier,attempt.apiOrderId);
  const label=normalize(result.status);
  if(label==="UNKNOWN"){await db.dispatchAttempt.update({where:{id},data:{lastCheckedAt:new Date()}});return;}
  if(result.remains===null&&label!=="COMPLETED"){
    await review(attempt.subOrder,"UNRELIABLE_REMAINS");return;
  }
  const rem=label==="COMPLETED"?0:bound(result.remains!,attempt.requested);
  const delivered=attempt.requested-rem;
  if(["COMPLETED","PARTIAL","CANCELED"].includes(label)){
    await terminal(attempt,attempt.subOrder,label,delivered,rem);return;
  }
  const delta=Math.max(0,delivered-attempt.delivered),now=new Date();
  await db.$transaction(async tx=>{
    const c=await tx.dispatchAttempt.updateMany({where:{id,delivered:attempt.delivered,
      state:{in:["SUBMITTED","PROCESSING","CANCEL_REQUESTED"]}},
      data:{delivered,remaining:rem,lastCheckedAt:now,
        state:attempt.state==="CANCEL_REQUESTED"?"CANCEL_REQUESTED":label==="PROCESSING"?"PROCESSING":"SUBMITTED"}});
    if(c.count)await tx.subOrder.update({where:{id:attempt.subOrderId},
      data:{delivered:{increment:delta},remaining:{decrement:delta},
        state:attempt.state==="CANCEL_REQUESTED"?"CANCEL_REQUESTED":label==="PROCESSING"?"PROCESSING":"SUBMITTED",
        lastProgressAt:delta?now:attempt.subOrder.lastProgressAt}});
  });
  const since=attempt.subOrder.lastProgressAt??attempt.createdAt;
  if(label!=="PENDING"||attempt.state==="CANCEL_REQUESTED"||
    now.getTime()-since.getTime()<30*60*1000)return;
  const route=await db.supplierRoute.findFirst({where:{supplierId:attempt.supplierId,
    serviceId:attempt.serviceId,kind:attempt.subOrder.kind,platform:attempt.subOrder.platform}});
  if(!route?.cancelable){await review(attempt.subOrder,"STALLED_UNCANCELLABLE");return;}
  const won=await db.dispatchAttempt.updateMany({where:{id,state:"SUBMITTED",cancelRequestedAt:null},
    data:{state:"CANCEL_REQUESTED",cancelRequestedAt:now}});
  if(!won.count)return;
  try{
    const ack=await requestCancellation(attempt.supplier,attempt.apiOrderId);
    if(!ack){await review(attempt.subOrder,"CANCEL_REJECTED");return;}
    await db.subOrder.update({where:{id:attempt.subOrderId},
      data:{state:"CANCEL_REQUESTED",cancelRequestedAt:now}});
  }catch{await review(attempt.subOrder,"CANCEL_UNKNOWN");}
  // ACK does not prove terminal cancellation. Never reroute until 'Canceled' status.
}
export async function syncOpen(limit=80) {
  const rows=await db.dispatchAttempt.findMany({where:{apiOrderId:{not:null},
    state:{in:["SUBMITTED","PROCESSING","CANCEL_REQUESTED"]},
    OR:[{lastCheckedAt:null},{lastCheckedAt:{lt:new Date(Date.now()-5*60*1000)}}]},
    orderBy:{lastCheckedAt:"asc"},take:Math.min(limit,100),select:{id:true}});
  let failed=0;
  for(let i=0;i<rows.length;i+=4){
    const batch=await Promise.allSettled(rows.slice(i,i+4).map(x=>poll(x.id)));
    failed+=batch.filter(x=>x.status==="rejected").length;
  }
  return {checked:rows.length,failed};
}
export async function quarantineLostReceipts() {
  const rows=await db.subOrder.findMany({where:{state:"DISPATCHING",leaseUntil:{lt:new Date()}},take:50});
  for(const s of rows){
    await db.$transaction([
      db.subOrder.updateMany({where:{id:s.id,state:"DISPATCHING"},
        data:{state:"UNKNOWN_OUTCOME",leaseUntil:null}}),
      db.dispatchAttempt.updateMany({where:{subOrderId:s.id,state:"DISPATCHING"},
        data:{state:"UNKNOWN_OUTCOME",lastError:"LOST_RECEIPT"}})
    ]);
    await notifyAlert("UNKNOWN_ACCEPTANCE",{subOrder:s.id}).catch(()=>{});
    await aggregate(s.masterId);
  }
  return rows.length;
}
