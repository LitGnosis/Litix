// Read-only Boostero status batching; never submits orders or retries supplier adds.
import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroProductionReady,boosteroSQL} from "./boosteroFulfillment.mjs";
const statuses={
 completed:{state:"COMPLETED",customer:"completed"},complete:{state:"COMPLETED",customer:"completed"},
 finished:{state:"COMPLETED",customer:"completed"},
 partial:{state:"SUBMITTED",customer:"partial"},
 canceled:{state:"FAILED",customer:"canceled"},cancelled:{state:"FAILED",customer:"canceled"},
 failed:{state:"FAILED",customer:"failed"},error:{state:"FAILED",customer:"failed"},
 pending:{state:"SUBMITTED",customer:"pending"},
 processing:{state:"SUBMITTED",customer:"processing"},
 "in progress":{state:"SUBMITTED",customer:"in_progress"}
};
export function mapBoosteroBatchStatus(value){
 if(!value||typeof value!=="object"||value.error)return null;
 const literal=String(value.status||"").trim().toLowerCase().replace(/[_-]/g," ");
 return statuses[literal]||null;
}
export async function syncBoosteroStatusesBatch({sql=boosteroSQL(),operation=boosteroProduction,limit=50}={}){
 if(!boosteroProductionReady())return {checked:0,failed:0,disabled:true};
 const cap=Math.max(1,Math.min(100,Number.isSafeInteger(limit)?limit:50));
 const orders=await sql.query(`select litix_order_id,supplier_order_id
  from public.litix_boostero_fulfillment where state='SUBMITTED'
  and supplier_order_id is not null
  and (checked_at is null or checked_at<now()-interval '15 minutes')
  order by checked_at nulls first limit $1`,[cap]);
 if(!orders.length)return {checked:0,failed:0};
 const ids=orders.map(x=>String(x.supplier_order_id));
 if(ids.some(x=>!/^\d{1,24}$/.test(x))||new Set(ids).size!==ids.length)
  return {checked:0,failed:orders.length,error:"supplier_status_ids_invalid"};
 let payload;
 try{
  payload=await operation("status",{orders:ids});
 }catch{
  return {checked:0,failed:orders.length,error:"supplier_status_batch_unavailable"};
 }
 if(!payload||typeof payload!=="object"||Array.isArray(payload))
  return {checked:0,failed:orders.length,error:"supplier_status_batch_invalid"};
 let checked=0,failed=0;
 for(const item of orders){
  const upstream=String(item.supplier_order_id),result=payload[upstream];
  const mapped=mapBoosteroBatchStatus(result);
  if(!mapped){failed++;continue;}
  const remains=Number(result.remains);
  const snapshot={provider:"boostero",status:String(result.status).slice(0,75),
   remains:Number.isSafeInteger(remains)&&remains>=0?remains:null,checked_at:new Date().toISOString()};
  try{
   const updated=await sql.query(`update public.litix_boostero_fulfillment
    set state=$3,supplier_status=$4::jsonb,checked_at=now(),updated_at=now()
    where litix_order_id=$1 and supplier_order_id=$2 and state='SUBMITTED' returning litix_order_id`,
    [item.litix_order_id,upstream,mapped.state,JSON.stringify(snapshot)]);
   if(!updated.length){failed++;continue;}
   await sql.query(`update public.litix_v2_orders
    set fulfillment_state=$3,last_supplier_status=$4::jsonb,updated_at=now()
    where id=$1 and supplier_order_id=$2 and payment_state='paid'`,
    [item.litix_order_id,upstream,mapped.customer,JSON.stringify(snapshot)]);
   checked++;
  }catch{failed++}
 }
 return {checked,failed,requested:orders.length,batched:true};
}
