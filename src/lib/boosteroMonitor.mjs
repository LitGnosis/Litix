import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroResilientRead} from "./boosteroResilientRead.mjs";
import {boosteroSQL,boosteroProductionReady,deliverLitixCustomerUpdates} from "./boosteroFulfillment.mjs";
import {normalizeBoosteroStatus} from "./boosteroStatusBatch.mjs";
import {queueCustomerDeliveryChange} from "./litixCustomerUpdates.mjs";

// Operations-only monitor: NO supplier add, refill, charge or automatic replacement.
const hasConfig=()=>boosteroProductionReady();
const positive=id=>/^\d{1,24}$/.test(String(id));
export async function pollPaidOrders({sql=boosteroSQL(),operation=boosteroResilientRead,limit=100}={}){
 if(!hasConfig())return {skipped:"provider_disabled"};
 // Atomic claim prevents concurrent cron invocations polling the same records.
 const work=await sql.query(`WITH chosen AS (
   SELECT f.litix_order_id FROM public.litix_boostero_fulfillment f
   JOIN public.litix_v2_orders o ON o.id=f.litix_order_id
   WHERE f.state='SUBMITTED' AND o.payment_state='paid'
     AND f.supplier_order_id IS NOT NULL
     AND (f.checked_at IS NULL OR f.checked_at<now()-interval '2 minutes')
   ORDER BY f.checked_at NULLS FIRST LIMIT $1 FOR UPDATE OF f SKIP LOCKED
 ) UPDATE public.litix_boostero_fulfillment f
   SET checked_at=now() FROM chosen c WHERE f.litix_order_id=c.litix_order_id
   RETURNING f.litix_order_id,f.supplier_order_id,f.supplier_status`,
  [Math.min(100,Math.max(1,limit))]);
 if(!work.length)return {checked:0,updated:0,failed:0};
 const ids=work.map(x=>String(x.supplier_order_id));
 if(ids.some(x=>!positive(x))||new Set(ids).size!==ids.length)
  return {checked:0,updated:0,failed:ids.length,error:"supplier_ids_need_review"};
 let statuses;
 try{
  statuses=await operation("status",{orders:ids});
 }catch(error){
  console.error("litix_batch_status_poll_failed",{kind:String(error?.message||"supplier").slice(0,64),count:ids.length});
  return {checked:0,updated:0,failed:ids.length};
 }
 if(!statuses||typeof statuses!=="object"||Array.isArray(statuses))
  return {checked:0,updated:0,failed:ids.length};
 let checked=0,updated=0,failed=0,manualReview=0;
 for(const item of work){
  const raw=statuses[String(item.supplier_order_id)];
  const normalized=normalizeBoosteroStatus(raw);
  if(!normalized){failed++;continue}
  const id=String(item.litix_order_id),providerId=String(item.supplier_order_id);
  const s=normalized.status.toLowerCase().replace(/_/g," ");
  const state=["completed","complete"].includes(s)?"COMPLETED":
   ["canceled","cancelled","failed","error"].includes(s)?"FAILED":
   s==="partial"?"MANUAL_REVIEW":"SUBMITTED";
  try{
   const paid=await sql.query(`SELECT quantity FROM public.litix_v2_orders
     WHERE id=$1 AND payment_state='paid' AND supplier_order_id=$2`,[id,providerId]);
   if(paid.length!==1){failed++;continue}
   const quantity=Number(paid[0].quantity);
   if(!Number.isSafeInteger(quantity)||quantity<=0||
      (normalized.remains!==null&&normalized.remains>quantity)){failed++;continue}
   const start=Number(raw.start_count);
   const snapshot={provider:"boostero",status:normalized.status,remains:normalized.remains,
    start_count:raw.start_count!==undefined&&Number.isSafeInteger(start)&&start>=0?start:null,
    checked_at:new Date().toISOString()};
   // Mail outbox is inserted BEFORE snapshot overwrite to avoid missing events.
   await queueCustomerDeliveryChange({sql,orderId:id,supplierOrderId:providerId,
    previous:item.supplier_status,latest:snapshot,state,quantity});
   const saved=await sql.query(`UPDATE public.litix_boostero_fulfillment SET
    state=$3,supplier_status=$4::jsonb,checked_at=now(),updated_at=now()
    WHERE litix_order_id=$1 AND supplier_order_id=$2 AND state='SUBMITTED'
    RETURNING litix_order_id`,[id,providerId,state,JSON.stringify(snapshot)]);
   if(saved.length!==1)continue;
   await sql.query(`UPDATE public.litix_v2_orders
     SET fulfillment_state=$3,last_supplier_status=$4::jsonb,updated_at=now()
     WHERE id=$1 AND supplier_order_id=$2 AND payment_state='paid'`,
    [id,providerId,state==="COMPLETED"?"completed":state==="FAILED"?"failed":state==="MANUAL_REVIEW"?"manual_review":"processing",JSON.stringify(snapshot)]);
   checked++;updated++;
   if(state==="MANUAL_REVIEW"||state==="FAILED")manualReview++;
  }catch(error){failed++;console.error("litix_status_db_update_failed",{orderId:id,code:String(error?.code||"db").slice(0,25)})}
 }
 // Completion/support notifications flow through the existing durable email outbox.
 let emails={skipped:"not_attempted"};
 try{emails=await deliverLitixCustomerUpdates({sql,limit:6})}catch{}
 return {checked,updated,failed,manualReview,emails};
}

export async function synchronizeCatalog({sql=boosteroSQL(),operation=boosteroResilientRead}={}){
 if(!hasConfig())return {skipped:"provider_disabled"};
 // A failed services API call never marks services disabled; stale listings
 // cannot authorize an order because the checkout verifies a LIVE quote.
 const rows=await operation("services");
 if(!Array.isArray(rows)||rows.length<1)throw Error("verified_catalog_empty");
 const catalog=new Map(rows.filter(x=>positive(x?.service)).map(x=>[String(x.service),x]));
 const approved=await sql.query(`SELECT supplier_service_id,retail_per_1000_cents,
     wholesale_ceiling_per_1000 FROM public.litix_boostero_services WHERE enabled=true`);
 let paused=0,checked=0;
 for(const item of approved){
  const live=catalog.get(String(item.supplier_service_id));
  const wholesale=Number(live?.rate);
  const retail=Number(item.retail_per_1000_cents);
  const allowed=live&&String(live.type).toLowerCase()==="default"&&
   Number.isSafeInteger(Number(live.min))&&Number(live.min)>=1&&
   Number.isSafeInteger(Number(live.max))&&Number(live.max)>=Number(live.min)&&
   Number(live.max)<=1000000&&Number.isFinite(wholesale)&&wholesale>0&&
   wholesale<=Number(item.wholesale_ceiling_per_1000)&&
   Number.isSafeInteger(retail)&&retail>=Math.ceil(wholesale*160-1e-8);
  checked++;
  if(allowed)continue;
  const changed=await sql.query(`UPDATE public.litix_boostero_services
   SET enabled=false WHERE supplier_service_id=$1 AND enabled=true
   RETURNING supplier_service_id`,[item.supplier_service_id]);
  paused+=changed.length;
 }
 return {checked,paused,activeSupplierListings:rows.length};
}

export async function checkBalance({operation=boosteroResilientRead,fetcher=fetch}={}){
 if(!hasConfig())return {skipped:"provider_disabled"};
 const b=await operation("balance");
 const dollars=Number(b?.balance);
 if(!Number.isFinite(dollars)||dollars<0)throw Error("provider_balance_invalid");
 if(dollars>=20)return {low:false,alertSent:false};
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!key)return {low:true,alertSent:false,error:"owner_email_not_configured"};
 const bucket=Math.floor(Date.now()/900000);
 const r=await fetcher("https://api.resend.com/emails",{
  method:"POST",cache:"no-store",redirect:"error",
  headers:{authorization:"Bearer "+key,"content-type":"application/json",
    "Idempotency-Key":"litix-boostero-balance-"+bucket},
  body:JSON.stringify({from:"Litix <orders@litix.net>",to:["litixsocial@gmail.com"],
    subject:"Litix — urgent supplier wallet below $20",
    text:"Litix supplier wallet is below $20 (currently $"+dollars.toFixed(2)+"). Review account balance before any new orders. This notice does not place orders or change payment routing."}),
  signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("litix_supplier_low_balance_alert_failed");
 return {low:true,alertSent:true};
}
