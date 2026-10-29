import {randomUUID} from "node:crypto";
import {normalizeBoosteroService} from "./boosteroGlobalCatalog.mjs";
import {validateBoosteroOrderDraft} from "./boosteroFullOrderContracts.mjs";
import {quoteBoostero60TypedUnits} from "./boosteroRetail60.mjs";

/**
 * One-shot typed Boostero API client. Never called by the existing storefront.
 * Requires a verified paid order, durable DB claim, owner-approved service,
 * current supplier details, and a separately enabled production release flag.
 *
 * A request timeout is UNKNOWN_OUTCOME, not "failed": no automatic replay.
 * This deliberately does not yet authorize package or subscription billing.
 */
const validOrder=id=>/^ltx2_[a-f\d-]{36}$/i.test(String(id||""));
const error=x=>({submitted:false,state:x,requiresReview:true});
export async function dispatchBoosteroTypedPaidOrder(orderId,{
 sql,inventorySQL,liveServices,fetchImpl=fetch,now=new Date(),enabled
}={}){
 if(!validOrder(orderId))return error("INVALID_ORDER_ID");
 if(enabled!==true||process.env.LITIX_BOOSTERO_TYPED_ORDERS_ENABLED!=="true"||
  process.env.VERCEL_ENV!=="production"||!process.env.BOOSTERO_API_KEY||
  process.env.LITIX_BOOSTERO_ENABLED!=="true")
  return {submitted:false,state:"TYPED_DISPATCH_DISABLED"};
 if(!sql||typeof sql.query!=="function"||!inventorySQL||typeof inventorySQL.query!=="function"||!Array.isArray(liveServices)||!liveServices.length)
  return error("VERIFICATION_NOT_READY");
 const orders=await sql.query(`
 select o.id,o.quantity,o.amount_cents,o.payment_state,o.payment_transaction_id,
        o.metadata,f.state,f.supplier_service_id,a.order_type,a.approved_retail_per_1000_cents,
        a.approved_wholesale_ceiling,a.special_contract_verified
 from public.litix_v2_orders o
 join public.litix_boostero_fulfillment f on f.litix_order_id=o.id
 join public.litix_boostero_full_service_approvals a
   on a.supplier_service_id=f.supplier_service_id and a.enabled=true
 where o.id=$1 and o.payment_state='paid' and o.payment_transaction_id is not null
   and f.state='QUEUED' and f.supplier_order_id is null
 limit 1`,[orderId]);
 if(orders.length!==1)return {submitted:false,state:"NOT_APPROVED_OR_ALREADY_CLAIMED"};
 const o=orders[0];
 // Imported inventory and customer orders are in separate Neon projects.
 // Check the inventory with its own read-only connection; no cross-DB join.
 const inventory=await inventorySQL.query(
  "select supplier_service_id,wholesale_per_1000,order_type,active,refreshed_at from public.litix_boostero_inventory where supplier_service_id=$1 and active=true and refreshed_at > now()-interval '36 hours' limit 1",
  [String(o.supplier_service_id)]
 );
 if(inventory.length!==1||String(inventory[0].order_type)!==String(o.order_type))
  return error("STAGING_INVENTORY_NOT_CURRENT_OR_DISABLED");
 const fresh=liveServices.find(x=>String(x?.service??x?.id)===String(o.supplier_service_id));
 const service=normalizeBoosteroService(fresh);
 if(!service||Number(inventory[0].wholesale_per_1000)!==Number(service.wholesalePer1000))
  return error("STAGING_AND_LIVE_SUPPLIER_PRICE_DIFFER");
 if(!service||service.type!==o.order_type||Number(service.wholesalePer1000)>Number(o.approved_wholesale_ceiling))
  return error("SUPPLIER_SERVICE_OR_PRICE_CHANGED");
 const input=o.metadata?.boostero_typed_draft;
 if(!input||typeof input!=="object")return error("ORDER_INPUT_NOT_VERIFIED");
 const draft=validateBoosteroOrderDraft(service,input);
 if(!draft.valid||draft.variableFutureCharge)return error("UNSUPPORTED_OR_VARIABLE_BILLING");
 // Packages and custom types require separately verified commercial terms.
 if(service.type!=="Default"&&o.special_contract_verified!==true)
  return error("SPECIAL_PRICING_NOT_VERIFIED");
 const qty=draft.estimatedTotalQuantity;
 const quote=quoteBoostero60TypedUnits({
  service,draft,approvedRetailPer1000Cents:Number(o.approved_retail_per_1000_cents)
 });
 if(!quote.valid||quote.totalUnits!==qty||quote.customerAmountCents!==Number(o.amount_cents))
  return error("PAID_PRICE_NOT_MATCHING_LIVE_SUPPLIER");
 // Production DB UPDATE is a one-way atomic claim. An uncertain supplier
 // result must never be retried automatically.
 const attemptId=randomUUID();
 const claimed=await sql.query(`
  update public.litix_boostero_fulfillment f
   set state='DISPATCHING',purchase_attempt_id=$2,attempted_at=$3::timestamptz,updated_at=now()
   where f.litix_order_id=$1 and f.state='QUEUED' and f.supplier_order_id is null
   and exists(select 1 from public.litix_v2_orders o where o.id=$1 and o.payment_state='paid'
             and o.payment_transaction_id is not null)
   and exists(select 1 from public.litix_boostero_full_service_approvals a
              where a.supplier_service_id=f.supplier_service_id and a.enabled=true)
   returning f.supplier_service_id`,[orderId,attemptId,new Date(now).toISOString()]);
 if(claimed.length!==1)return {submitted:false,state:"ALREADY_CLAIMED_NO_RETRY"};
 try{await sql.query(
  "insert into public.litix_boostero_attempts(id,litix_order_id,kind,state) values($1,$2,'add','STARTED')",
  [attemptId,orderId]);
 }catch{
  await sql.query("update public.litix_boostero_fulfillment set state='MANUAL_REVIEW',error_code='audit_lock_failed' where litix_order_id=$1 and purchase_attempt_id=$2",[orderId,attemptId]).catch(()=>{});
  return error("MANUAL_REVIEW");
 }
 let supplierResult;
 try{
  const endpoint=new URL(process.env.BOOSTERO_API_URL||"");
  if(endpoint.origin!=="https://boostero.com"||endpoint.pathname!=="/api/v2"||
   endpoint.search||endpoint.hash||endpoint.username||endpoint.password)
   throw Error("endpoint_invalid");
  const r=await fetchImpl(endpoint.href,{method:"POST",redirect:"error",cache:"no-store",
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({key:process.env.BOOSTERO_API_KEY,action:"add",...draft.params}).toString(),
   signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error("supplier_http_unconfirmed");
  supplierResult=await r.json();
  if(supplierResult?.error)throw Error("supplier_rejected");
  if(!/^\d{1,24}$/.test(String(supplierResult?.order||"")))throw Error("supplier_confirmation_missing");
 }catch{
  await Promise.allSettled([
   sql.query("update public.litix_boostero_fulfillment set state='UNKNOWN_OUTCOME',error_code='review_supplier_account',updated_at=now() where litix_order_id=$1 and purchase_attempt_id=$2 and state='DISPATCHING'",[orderId,attemptId]),
   sql.query("update public.litix_boostero_attempts set state='UNKNOWN_OUTCOME',error_code='review_supplier_account',finished_at=now() where id=$1",[attemptId])
  ]);
  return error("UNKNOWN_OUTCOME");
 }
 const supplierOrderId=String(supplierResult.order);
 try{
  const saved=await sql.query(
   "update public.litix_boostero_fulfillment set supplier_order_id=$2,state='SUBMITTED',updated_at=now() where litix_order_id=$1 and purchase_attempt_id=$3 and state='DISPATCHING' returning supplier_order_id",
   [orderId,supplierOrderId,attemptId]);
  if(saved.length!==1)throw Error("receipt_not_persisted");
  await sql.query("update public.litix_boostero_attempts set supplier_order_id=$2,state='CONFIRMED',finished_at=now() where id=$1",[attemptId,supplierOrderId]);
  await sql.query(
   "update public.litix_v2_orders set supplier_order_id=$2,fulfillment_state='submitted',updated_at=now() where id=$1 and supplier_order_id is null",
   [orderId,supplierOrderId]);
  return {submitted:true,state:"SUBMITTED",supplierOrderId};
 }catch{return error("UNKNOWN_OUTCOME")}
}
