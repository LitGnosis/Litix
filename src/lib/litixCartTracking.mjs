import {randomUUID} from "node:crypto";
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroSQL} from "./boosteroFulfillment.mjs";

const normalized=x=>String(x||"").trim().toLowerCase().replace(/[_\s-]+/g," ");
function supplierState(x){
 if(["complete","completed","finished"].includes(x))return "COMPLETED";
 if(["partial","partially completed","canceled","cancelled","failed","error"].includes(x))
  return "MANUAL_REVIEW";
 return "SUBMITTED";
}
export async function syncCartOrderStatuses({sql=boosteroSQL(),operation=boosteroProduction,limit=12}={}){
 if(process.env.LITIX_CART_BUMPS_ENABLED!=="true")return {disabled:true,checked:0};
 const rows=await sql.query(
  "select order_id,ordinal,supplier_order_id,quantity,supplier_status from public.litix_cart_lines where state='SUBMITTED' and supplier_order_id is not null and (checked_at is null or checked_at<now()-interval '15 minutes') order by checked_at nulls first limit $1",
  [Math.max(1,Math.min(20,limit))]);
 if(!rows.length)return {checked:0};
 const statuses=await operation("status",{orders:rows.map(x=>x.supplier_order_id)});
 let checked=0,failed=0;
 const parents=new Set();
 for(const row of rows){
  const snapshot=statuses?.[String(row.supplier_order_id)];
  if(!snapshot||snapshot.error||typeof snapshot.status!=="string"){failed++;continue;}
  const state=supplierState(normalized(snapshot.status));
  const start=Number(snapshot.start_count);
  const validStart=Number.isSafeInteger(start)&&start>=0?start:null;
  const remains=Number(snapshot.remains);
  const validRemains=Number.isSafeInteger(remains)&&remains>=0&&remains<=row.quantity?remains:null;
  const raw={status:String(snapshot.status).slice(0,80),
   remains:validRemains,start_count:validStart,checked_at:new Date().toISOString()};
  try{
   await sql.query(
    "update public.litix_cart_lines set state=$4,supplier_status=$5::jsonb,checked_at=now(),start_count=coalesce(start_count,$6),completed_at=case when $4='COMPLETED' then coalesce(completed_at,now()) else completed_at end,updated_at=now() where order_id=$1 and ordinal=$2 and supplier_order_id=$3 and state='SUBMITTED'",
    [row.order_id,row.ordinal,String(row.supplier_order_id),state,JSON.stringify(raw),validStart]);
   await sql.query(
    "insert into public.litix_order_proof_events(id,order_id,ordinal,event_type,details) values($1,$2,$3,$4,$5::jsonb)",
    [randomUUID(),row.order_id,row.ordinal,state==="COMPLETED"?"DELIVERY_COMPLETED":state==="MANUAL_REVIEW"?"REVIEW_REQUIRED":"DELIVERY_STATUS_RECORDED",
     JSON.stringify({supplierOrderId:String(row.supplier_order_id),status:raw.status,
      remains:validRemains,startCount:validStart})]);
   parents.add(row.order_id);checked++;
  }catch{failed++;}
 }
 for(const orderId of parents){
  const progress=await sql.query(
   "select count(*)::int as total,count(*) filter (where state='COMPLETED')::int as done from public.litix_cart_lines where order_id=$1",
   [orderId]);
  if(progress[0]?.total===2&&progress[0]?.done===2){
   await sql.query(
    "update public.litix_boostero_fulfillment set state='COMPLETED',updated_at=now() where litix_order_id=$1 and state='SUBMITTED'",
    [orderId]).catch(()=>{});
   await sql.query(
    "update public.litix_v2_orders set fulfillment_state='completed',updated_at=now() where id=$1 and payment_state='paid'",
    [orderId]).catch(()=>{});
  }
 }
 return {checked,failed};
}
