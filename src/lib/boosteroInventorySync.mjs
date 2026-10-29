/**
 * Full Boostero inventory sync. Additive and atomic: an entire complete supplier
 * snapshot commits together or not at all. Never changes enabled public cards,
 * payment records, supplier dispatch, customer orders, or historical inventory IDs.
 */
import {normalizeBoosteroCatalog} from "./boosteroGlobalCatalog.mjs";
import {boosteroRetailCandidate} from "./boosteroRetail25.mjs";
export async function importBoosteroInventory(sql,raw,{now=new Date(),force=false}={}){
 if(!sql||typeof sql.query!=="function")throw Error("inventory_database_unavailable");
 const {items,stats}=normalizeBoosteroCatalog(raw);
 if(items.length<100||items.length/Math.max(raw.length,1)<0.95)
  throw Error("inventory_supplier_snapshot_incomplete");
 const date=new Date(now),timestamp=date.toISOString();
 const existing=await sql.query(
  "select count(*)::integer as n, max(refreshed_at) as last_sync from public.litix_boostero_inventory"
 );
 const previous=Number(existing[0]?.n||0),last=existing[0]?.last_sync;
 if(!force&&last&&date.getTime()-new Date(last).getTime()<30*60*1000)
  return {skipped:"recent_successful_sync",...stats,previous};
 if(previous>0&&items.length<Math.ceil(previous*0.85))
  throw Error("inventory_unexpected_catalog_shrink");
 const payload=items.map(x=>{
  const unitPriced=x.type==="Default" && x.dripfeed!==true;
  const pricing=unitPriced?boosteroRetailCandidate(x.wholesalePer1000):
   {retailCents:null,reviewReason:"special_service_price_contract_unverified"};
  if(unitPriced&&pricing.retailCents===null)throw Error("inventory_wholesale_price_invalid");
  return {
   id:x.id,name:x.name,category:x.category,platform:x.platform,kind:x.kind,type:x.type,
   rate:x.wholesalePer1000,min:x.min,max:x.max,refill:x.refill,cancel:x.cancel,
   dripfeed:x.dripfeed,refill_days:x.refillDays,compatible:x.supportedInputShape,
   retail:pricing.retailCents,
   review:pricing.reviewReason||(x.supportedInputShape?null:"order_input_contract_unverified")
  };
 });
 // One PostgreSQL statement = one transaction even over Neon's serverless HTTP.
 // The 1,814-record snapshot is sent as one bound JSON parameter, never SQL text.
 // Source IDs are authoritative, so repeated runs are idempotent.
 const rows=await sql.query(`
 WITH incoming AS MATERIALIZED (
   SELECT * FROM jsonb_to_recordset($1::jsonb) as x(
     id text,name text,category text,platform text,kind text,type text,
     rate numeric,min integer,max integer,retail bigint,review text,refill boolean,cancel boolean,
     dripfeed boolean,refill_days integer,compatible boolean)
 ), applied AS (
   INSERT INTO public.litix_boostero_inventory(
     supplier_service_id,service_name,supplier_category,platform,service_kind,order_type,
     wholesale_per_1000,minimum_quantity,maximum_quantity,retail_per_1000_cents,pricing_review_reason,refill_eligible,cancel_eligible,
     dripfeed_eligible,refill_days,standard_input_compatible,active,last_seen_at,refreshed_at)
   SELECT id,name,category,platform,kind,type,rate,min,max,retail,review,refill,cancel,dripfeed,
     refill_days,compatible,true,$2::timestamptz,$2::timestamptz FROM incoming
   ON CONFLICT(supplier_service_id) DO UPDATE SET
     service_name=excluded.service_name,supplier_category=excluded.supplier_category,
     platform=excluded.platform,service_kind=excluded.service_kind,
     order_type=excluded.order_type,wholesale_per_1000=excluded.wholesale_per_1000,
     minimum_quantity=excluded.minimum_quantity,maximum_quantity=excluded.maximum_quantity,
     retail_per_1000_cents=excluded.retail_per_1000_cents,
     pricing_review_reason=excluded.pricing_review_reason,
     refill_eligible=excluded.refill_eligible,cancel_eligible=excluded.cancel_eligible,
     dripfeed_eligible=excluded.dripfeed_eligible,refill_days=excluded.refill_days,
     standard_input_compatible=excluded.standard_input_compatible,
     active=true,last_seen_at=excluded.last_seen_at,refreshed_at=excluded.refreshed_at
   RETURNING supplier_service_id
 ), retired AS (
   UPDATE public.litix_boostero_inventory AS old
     SET active=false,refreshed_at=$2::timestamptz
   WHERE old.active=true
     AND NOT EXISTS (SELECT 1 FROM incoming WHERE id=old.supplier_service_id)
   RETURNING old.supplier_service_id
 ), logged AS (
   INSERT INTO public.litix_boostero_inventory_syncs(
     retrieved_count,valid_count,invalid_count,enabled_count,result,notes)
   SELECT $3::integer,$4::integer,$5::integer,0,'success',
     'Atomic Boostero inventory snapshot; no public auto-activation'
   RETURNING id
 )
 SELECT (SELECT count(*)::integer FROM applied) AS imported,
        (SELECT count(*)::integer FROM retired) AS marked_unavailable,
        (SELECT count(*)::integer FROM logged) AS audit_records
 `,[JSON.stringify(payload),timestamp,stats.retrieved,stats.valid,stats.invalid]);
 if(Number(rows[0]?.imported)!==items.length||Number(rows[0]?.audit_records)!==1)
  throw Error("inventory_atomic_write_unconfirmed");
 return {...stats,pricingReviewCount:payload.filter(x=>x.review).length,pricingMultiplier:2.5,imported:items.length,markedUnavailable:Number(rows[0]?.marked_unavailable||0),
  publicNewServicesEnabled:0,checkoutAllowlistUnchanged:true,syncedAt:timestamp,
  atomicCommitVerified:true};
}
