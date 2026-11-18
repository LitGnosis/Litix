import {boosteroSQL,hashBoostero} from "../../../../../lib/boosteroFulfillment.mjs";
import {boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {curatedSupplierSnapshot} from "../../../../../lib/curatedCatalog.mjs";
import {publicServiceCardName} from "../../../../../lib/serviceCardDisplay.mjs";
import {boosteroSupplierDelivered,normalizeBoosteroStatus,boosteroChildState} from "../../../../../lib/boosteroStatusBatch.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"cache-control":"private, no-store","referrer-policy":"no-referrer",
 "x-robots-tag":"noindex","x-content-type-options":"nosniff"};
const safeReply=(body,status=200)=>Response.json(body,{status,headers});
const bounded=(work,ms=3200)=>Promise.race([
 Promise.resolve().then(work),
 new Promise((_,reject)=>setTimeout(()=>reject(Error("lookup_timeout")),ms))
]);
const canRefill=x=>x?.refill===true||x?.refillable===true||String(x?.refill)==="1";

export async function GET(request){
 const p=new URL(request.url).searchParams,id=String(p.get("order")||""),
  token=String(p.get("token")||"");
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||token.length<25||token.length>150)
  return safeReply({error:"Private order tracking link required"},400);
 if((request.headers.get("accept")||"").includes("text/html")){
  const target=new URL("/track",request.url);
  target.searchParams.set("track",id);target.searchParams.set("token",token);
  return new Response(null,{status:303,headers:{...headers,location:target.toString()}});
 }
 let found;
 const sql=boosteroSQL();
 try{
  found=await sql.query(
   "select o.id,o.service_name,o.quantity,o.amount_cents,o.payment_state,o.metadata,f.state,f.supplier_service_id,f.supplier_order_id,f.supplier_status,f.checked_at from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1 and o.tracking_token_hash=$2",
   [id,hashBoostero(token)]);
 }catch{return safeReply({error:"Order tracking temporarily unavailable"},503)}
 if(found.length!==1)return safeReply({error:"Order not found"},404);
 const x=found[0];
 let liveStatus=false;
 const lastTime=x.checked_at?new Date(x.checked_at).getTime():0;
 if(x.payment_state==="paid"&&x.supplier_order_id&&["SUBMITTED","COMPLETED"].includes(x.state)&&
   (!lastTime||Date.now()-lastTime>60000)){
  try{
   const raw=await bounded(()=>boosteroProduction("status",{order:String(x.supplier_order_id)}));
   const status=normalizeBoosteroStatus(raw);
   if(status&&status.remains!==null&&status.remains>Number(x.quantity))throw Error("invalid_remaining_quantity");
   if(status){
    const next=boosteroChildState(status.status);
    const previousCount=x.supplier_status?.start_count;
    const incomingCount=raw?.start_count;
    const startCount=[incomingCount,previousCount].map(Number)
     .find(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000000);
    const recordedStatus=startCount===undefined?status:{...status,start_count:startCount};
    await sql.query(
     "update public.litix_boostero_fulfillment set supplier_status=$2::jsonb,checked_at=now(),state=case when $3='COMPLETED' then 'COMPLETED' when $3='MANUAL_REVIEW' then 'MANUAL_REVIEW' else state end,updated_at=now() where litix_order_id=$1 and supplier_order_id=$4 and state in ('SUBMITTED','COMPLETED')",
     [id,JSON.stringify(recordedStatus),next,String(x.supplier_order_id)]);
    x.supplier_status=recordedStatus;x.checked_at=new Date();
    if(next==="COMPLETED"||next==="MANUAL_REVIEW")x.state=next;
    liveStatus=true;
   }
  }catch{/* Preserve the last recorded status; no retries or new fulfillment. */}
 }
 const allocations=Array.isArray(x.metadata?.postAllocations)?x.metadata.postAllocations.slice(0,5):[];
 let posts=allocations.map((p,i)=>({index:i+1,url:String(p.link||""),
  quantity:Number(p.quantity||0),status:x.state==="MANUAL_REVIEW"?"Needs order review":"Processing",remains:null}));
 if(allocations.length&&process.env.LITIX_MULTIPOST_AUTO_FULFILL_ENABLED==="true"){
  try{
   const children=await sql.query(
    "select ordinal,destination,quantity,state,supplier_status,checked_at from public.litix_boostero_multi_posts where parent_order_id=$1 order by ordinal limit 5",[id]);
   if(children.length)posts=children.map(p=>({index:Number(p.ordinal),url:p.destination,
    quantity:Number(p.quantity),status:normalizeBoosteroStatus(p.supplier_status)?.status||p.state,
    remains:normalizeBoosteroStatus(p.supplier_status)?.remains??null,
    delivered:boosteroSupplierDelivered(p.quantity,p.supplier_status?.remains),
    checkedAt:p.checked_at||null}));
  }catch{}
 }
 let refillEligible=false;
 if(x.payment_state==="paid"&&x.state==="COMPLETED"&&x.supplier_order_id&&x.supplier_service_id){
  try{
   const [services,attempts]=await bounded(()=>Promise.all([
    curatedSupplierSnapshot(),
    sql.query("select id from public.litix_boostero_attempts where litix_order_id=$1 and kind='refill' limit 1",[id])
   ]));
   const service=services.find(row=>String(row.service)===String(x.supplier_service_id));
   refillEligible=Boolean(service&&canRefill(service)&&attempts.length===0);
  }catch{}
 }
 const remains=normalizeBoosteroStatus(x.supplier_status)?.remains??null;
 const status=normalizeBoosteroStatus(x.supplier_status)?.status||null;
 return safeReply({order:{id:x.id,service:publicServiceCardName({name:x.service_name}),
  quantity:x.quantity,amountCents:x.amount_cents,payment:x.payment_state,fulfillment:x.state,
  supplierStatus:status,remains,lastChecked:x.checked_at||null,posts,
  startCount:Number.isSafeInteger(Number(x.supplier_status?.start_count))&&
   x.supplier_status?.start_count!==null&&x.supplier_status?.start_count!==undefined
   ?Number(x.supplier_status.start_count):null,
  delivered:boosteroSupplierDelivered(x.quantity,remains),liveStatus,refillEligible}});
}
