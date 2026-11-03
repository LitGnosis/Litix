// Boostero-only autonomous fixed-price bundle fulfillment.
// Never charges a card and never repeats an ambiguous supplier submission.
import {randomUUID} from "node:crypto";
import {bundleDB} from "./bundleOrders.mjs";
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {chooseBundleBoosteroService} from "./growthBundleRouting.mjs";

export async function stagePaidBundlePlan(orderId,plan,{sql=bundleDB()}={}){
 if(!/^lbg_[0-9a-f-]{36}$/i.test(orderId)||!Array.isArray(plan?.legs)||!plan.legs.length||plan.legs.length>31)
  throw Error("invalid_bundle_ledger_plan");
 const data=plan.legs.map(x=>({
  ordinal:Number(x.ordinal),kind:x.kind,destination:x.destination,
  supplierServiceId:String(x.serviceId),quantity:Number(x.quantity),
  quotedWholesaleCents:Number(x.wholesaleCents)
 }));
 const inserted=await sql.query(
  "insert into public.litix_growth_bundle_auto_dispatch(order_id,ordinal,kind,destination,supplier_service_id,quantity,quoted_wholesale_cents,state) select $1,(p->>'ordinal')::smallint,p->>'kind',p->>'destination',p->>'supplierServiceId',(p->>'quantity')::int,(p->>'quotedWholesaleCents')::int,'PENDING_PAYMENT' from jsonb_array_elements($2::jsonb) p where exists(select 1 from public.litix_growth_bundle_orders o where o.id=$1 and o.payment_state='processing' and o.payment_provider='paykings') on conflict do nothing returning ordinal",
  [orderId,JSON.stringify(data)]);
 if(inserted.length!==data.length)throw Error("bundle_children_stage_incomplete");
 const activated=await sql.query(
  "update public.litix_growth_bundle_orders set auto_fulfillment_enabled=true,updated_at=now() where id=$1 and payment_state='processing' and payment_provider='paykings' and (select count(*) from public.litix_growth_bundle_auto_dispatch where order_id=$1)=$2 returning id",
  [orderId,data.length]);
 if(activated.length!==1)throw Error("bundle_stage_commit_unverified");
 return inserted.length;
}
export async function releaseSettledBundle(orderId,{sql=bundleDB()}={}){
 const released=await sql.query(
  "update public.litix_growth_bundle_auto_dispatch d set state='QUEUED',updated_at=now() where d.order_id=$1 and d.state='PENDING_PAYMENT' and exists(select 1 from public.litix_growth_bundle_orders o where o.id=$1 and o.payment_provider='paykings' and o.auto_fulfillment_enabled=true and o.payment_state='settled' and o.settled_at is not null and o.gateway_transaction_id is not null) returning ordinal",
  [orderId]);
 if(released.length)await sql.query(
  "update public.litix_growth_bundle_orders set order_state='Processing',updated_at=now() where id=$1 and payment_state='settled' and auto_fulfillment_enabled=true",
  [orderId]);
 return released.length;
}
async function updateBundleAggregate(orderId,sql){
 const status=await sql.query(
  "select state,count(*)::int as n from public.litix_growth_bundle_auto_dispatch where order_id=$1 group by state",
  [orderId]);
 const m=Object.fromEntries(status.map(x=>[x.state,Number(x.n)]));
 const total=Object.values(m).reduce((a,b)=>a+b,0);
 if(!total)return;
 const problematic=(m.UNKNOWN_OUTCOME||0)+(m.MANUAL_REVIEW||0)>0;
 const completed=(m.COMPLETED||0)===total;
 const state=problematic?"Needs Attention":completed?"Completed":"Processing";
 await sql.query("update public.litix_growth_bundle_orders set order_state=$2,updated_at=now() where id=$1 and auto_fulfillment_enabled=true and payment_state='settled'",[orderId,state]);
}
export async function dispatchPaidBundleChild(orderId,ordinal,{sql=bundleDB(),operation=boosteroProduction}={}){
 const attempt=randomUUID();
 const rows=await sql.query(
  "update public.litix_growth_bundle_auto_dispatch d set state='DISPATCHING',attempt_id=$3,attempted_at=now(),updated_at=now() where d.order_id=$1 and d.ordinal=$2 and d.state='QUEUED' and d.attempt_id is null and d.supplier_order_id is null and exists(select 1 from public.litix_growth_bundle_orders o where o.id=d.order_id and o.payment_provider='paykings' and o.payment_state='settled' and o.settled_at is not null and o.gateway_transaction_id is not null and o.auto_fulfillment_enabled=true) returning d.order_id,d.ordinal,d.kind,d.destination,d.supplier_service_id,d.quantity,d.quoted_wholesale_cents",
  [orderId,ordinal,attempt]);
 if(rows.length!==1)return {claimed:false};
 const item=rows[0];let submitted=false;
 try{
  const parent=await sql.query("select platform,price_cents from public.litix_growth_bundle_orders where id=$1 and payment_state='settled' and auto_fulfillment_enabled=true",[orderId]);
  if(parent.length!==1)throw Error("parent_not_paid");
  const catalog=await operation("services");
  const raw=catalog.find(x=>String(x.service??x.id)==String(item.supplier_service_id));
  const verified=chooseBundleBoosteroService(raw?[raw]:[],parent[0].platform,{kind:item.kind,quantity:Number(item.quantity)});
  if(!verified||verified.id!==String(item.supplier_service_id))throw Error("supplier_mapping_no_longer_safe");
  const wholesaleNow=Math.ceil(verified.rate*100*Number(item.quantity)/1000-1e-8);
  if(wholesaleNow>Number(item.quoted_wholesale_cents))throw Error("supplier_rate_increased");
  const wallet=await operation("balance");
  if(String(wallet?.currency||"").toUpperCase()!=="USD"||!Number.isFinite(Number(wallet?.balance))||
    Number(wallet.balance)<wholesaleNow/100)throw Error("supplier_wallet_insufficient");
  submitted=true;
  const result=await operation("add",{
   service:String(item.supplier_service_id),link:item.destination,quantity:Number(item.quantity)
  },{claimed:true});
  if(!/^\d{1,24}$/.test(String(result?.order||"")))throw Error("supplier_receipt_uncertain");
  const saved=await sql.query(
   "update public.litix_growth_bundle_auto_dispatch set state='SUBMITTED',supplier_order_id=$4,supplier_status=$5::jsonb,updated_at=now() where order_id=$1 and ordinal=$2 and state='DISPATCHING' and attempt_id=$3 returning ordinal",
   [orderId,ordinal,attempt,String(result.order),JSON.stringify({status:"Pending"})]);
  if(saved.length!==1)throw Error("supplier_receipt_storage_uncertain");
  return {claimed:true,state:"SUBMITTED",ordinal};
 }catch(error){
  // Once the supplier call has started, outcome is unknown until independently checked.
  const state=submitted?"UNKNOWN_OUTCOME":"MANUAL_REVIEW";
  await sql.query(
   "update public.litix_growth_bundle_auto_dispatch set state=$4,error_code=$5,updated_at=now() where order_id=$1 and ordinal=$2 and state='DISPATCHING' and attempt_id=$3",
   [orderId,ordinal,attempt,state,String(error?.message||"unknown").slice(0,70)]).catch(()=>{});
  return {claimed:true,state,ordinal};
 }finally{
  await updateBundleAggregate(orderId,sql).catch(()=>{});
 }
}
export async function dispatchPaidBundleBatch(orderId,{sql=bundleDB(),operation=boosteroProduction,limit=4}={}){
 const count=Math.max(1,Math.min(6,Number(limit)||4));
 const work=await sql.query(
  "select ordinal from public.litix_growth_bundle_auto_dispatch where order_id=$1 and state='QUEUED' and attempt_id is null order by ordinal limit $2",
  [orderId,count]);
 const results=await Promise.all(work.map(item=>dispatchPaidBundleChild(orderId,Number(item.ordinal),{sql,operation})));
 return {attempted:results.length,confirmed:results.filter(x=>x.state==="SUBMITTED").length,needsReview:results.filter(x=>x.state==="UNKNOWN_OUTCOME"||x.state==="MANUAL_REVIEW").length};
}
export async function resumeSettledBundles({sql=bundleDB(),operation=boosteroProduction,limit=4}={}){
 const orders=await sql.query(
  "select distinct d.order_id from public.litix_growth_bundle_auto_dispatch d join public.litix_growth_bundle_orders o on o.id=d.order_id where d.state in ('PENDING_PAYMENT','QUEUED') and o.auto_fulfillment_enabled=true and o.payment_provider='paykings' and o.payment_state='settled' and o.gateway_transaction_id is not null and o.settled_at is not null order by d.order_id limit $1",[Math.min(Math.max(1,limit),8)]);
 const done=[];
 for(const o of orders){
  await releaseSettledBundle(o.order_id,{sql});
  const result=await dispatchPaidBundleBatch(o.order_id,{sql,operation,limit:4});
  done.push({orderId:o.order_id,...result});
 }
 return done;
}
export async function syncBundleChildStatuses({sql=bundleDB(),operation=boosteroProduction,limit=5}={}){
 const candidates=await sql.query(
  "select order_id,ordinal,supplier_order_id from public.litix_growth_bundle_auto_dispatch where state='SUBMITTED' and supplier_order_id is not null and (checked_at is null or checked_at<now()-interval '15 minutes') order by checked_at nulls first limit $1",
  [Math.min(Math.max(1,limit),10)]);
 let checked=0;
 for(const c of candidates){
  try{
   const status=await operation("status",{order:String(c.supplier_order_id)});
   const label=String(status?.status||"Unknown");
   const finalState=/^completed$/i.test(label)?"COMPLETED":
    /^(?:cancelled|canceled|failed|error)$/i.test(label)?"MANUAL_REVIEW":"SUBMITTED";
   await sql.query(
    "update public.litix_growth_bundle_auto_dispatch set state=$4,supplier_status=$5::jsonb,checked_at=now(),updated_at=now() where order_id=$1 and ordinal=$2 and supplier_order_id=$3 and state='SUBMITTED'",
    [c.order_id,c.ordinal,c.supplier_order_id,finalState,JSON.stringify({status:label,remains:status?.remains??null})]);
   await updateBundleAggregate(c.order_id,sql);
   checked++;
  }catch{}
 }
 return checked;
}
