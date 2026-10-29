/**
 * Full Boostero inventory sync. Additive and atomic: an entire complete supplier
 * snapshot commits together or not at all. Never changes enabled public cards,
 * payment records, supplier dispatch, customer orders, or historical inventory IDs.
 */
import {normalizeBoosteroCatalog} from "./boosteroGlobalCatalog.mjs";
import {boosteroRetailCandidate} from "./boosteroRetail25.mjs";
import {checkBoosteroService,validateBoosteroBatch} from "./boosteroServiceValidation.mjs";
import {proposeServiceRetail} from "./pricing.mjs";
export async function importBoosteroInventory(sql,raw,{now=new Date(),force=false,autoPublish=false}={}){
 if(!sql||typeof sql.query!=="function")throw Error("inventory_database_unavailable");
 const {items,stats}=normalizeBoosteroCatalog(raw);
 if(items.length<100||items.length/Math.max(raw.length,1)<0.95)
  throw Error("inventory_supplier_snapshot_incomplete");
 const validation=validateBoosteroBatch(raw,{approvedCheckout:false});
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
  const checked=checkBoosteroService(raw.find(y=>String(y?.service??y?.id??"")===x.id),{approvedCheckout:autoPublish});
  const unitPriced=x.type==="Default" && x.dripfeed!==true;
  const pricing=unitPriced?boosteroRetailCandidate(x.wholesalePer1000):
   {retailCents:null,reviewReason:"special_service_price_contract_unverified"};
  if(unitPriced&&pricing.retailCents===null)throw Error("inventory_wholesale_price_invalid");
  let finalRetail=pricing.retailCents;
  let finalReason=pricing.reviewReason||checked.reason||(x.supportedInputShape?null:"order_input_contract_unverified");
  let state=checked.state;
  if(x.kind==="followers"&&x.supportedInputShape&&!finalReason){
   const ladder=proposeServiceRetail({name:x.name,category:x.category,refill:x.refill},x.wholesalePer1000);
   if(ladder.action!=="reprice"||!Number.isSafeInteger(ladder.retailPer1000Cents)){
    finalReason="follower_refill_ladder_unverified";state="PENDING_REVIEW";
   }else finalRetail=Math.max(finalRetail,ladder.retailPer1000Cents);
  }
  // Existing IG/TK database constraint requires $6+ per thousand.
  if(x.supportedInputShape&&finalRetail!==null)finalRetail=Math.max(finalRetail,600);
  return {
   id:x.id,name:x.name,category:x.category,platform:x.platform,kind:x.kind,type:x.type,
   rate:x.wholesalePer1000,min:x.min,max:x.max,refill:x.refill,cancel:x.cancel,
   dripfeed:x.dripfeed,refill_days:x.refillDays,compatible:x.supportedInputShape,
   retail:finalRetail,
   review:finalReason,
   state:finalReason&&checked.state==="PURCHASABLE"?"PENDING_REVIEW":state,adapter:x.supportedInputShape?"ig_tk_default_v1":null
  };
 });
 // One PostgreSQL statement = one transaction even over Neon's serverless HTTP.
 // The 1,814-record snapshot is sent as one bound JSON parameter, never SQL text.
 // Source IDs are authoritative, so repeated runs are idempotent.
 const rows=await sql.query(`
 WITH incoming AS MATERIALIZED (
   SELECT * FROM jsonb_to_recordset($1::jsonb) as x(
     id text,name text,category text,platform text,kind text,type text,
     rate numeric,min integer,max integer,retail bigint,review text,state text,adapter text,refill boolean,cancel boolean,
     dripfeed boolean,refill_days integer,compatible boolean)
 ), applied AS (
   INSERT INTO public.litix_boostero_inventory(
     supplier_service_id,service_name,supplier_category,platform,service_kind,order_type,
     wholesale_per_1000,minimum_quantity,maximum_quantity,retail_per_1000_cents,pricing_review_reason,validation_state,validation_reason,checkout_adapter,last_verified_at,refill_eligible,cancel_eligible,
     dripfeed_eligible,refill_days,standard_input_compatible,active,last_seen_at,refreshed_at)
   SELECT id,name,category,platform,kind,type,rate,min,max,retail,review,state,review,adapter,$2::timestamptz,refill,cancel,dripfeed,
     refill_days,compatible,true,$2::timestamptz,$2::timestamptz FROM incoming
   ON CONFLICT(supplier_service_id) DO UPDATE SET
     service_name=excluded.service_name,supplier_category=excluded.supplier_category,
     platform=excluded.platform,service_kind=excluded.service_kind,
     order_type=excluded.order_type,wholesale_per_1000=excluded.wholesale_per_1000,
     minimum_quantity=excluded.minimum_quantity,maximum_quantity=excluded.maximum_quantity,
     retail_per_1000_cents=excluded.retail_per_1000_cents,
     pricing_review_reason=excluded.pricing_review_reason,
     validation_state=excluded.validation_state,validation_reason=excluded.validation_reason,
     checkout_adapter=excluded.checkout_adapter,last_verified_at=excluded.last_verified_at,
     refill_eligible=excluded.refill_eligible,cancel_eligible=excluded.cancel_eligible,
     dripfeed_eligible=excluded.dripfeed_eligible,refill_days=excluded.refill_days,
     standard_input_compatible=excluded.standard_input_compatible,
     active=true,last_seen_at=excluded.last_seen_at,refreshed_at=excluded.refreshed_at
   RETURNING supplier_service_id
 ), activated AS (
   INSERT INTO public.litix_boostero_services
     (supplier_service_id,platform,service_kind,retail_per_1000_cents,
      wholesale_ceiling_per_1000,enabled,approved_by,approved_at)
   SELECT id,lower(platform),kind,retail::integer,rate,true,
     'boostero_verified_default_contract_v1',now()
   FROM incoming
   WHERE $6::boolean=true AND state='PURCHASABLE' AND review IS NULL
    AND adapter='ig_tk_default_v1' AND type='Default' AND
    platform IN('Instagram','TikTok') AND kind IN('followers','likes')
    AND retail BETWEEN 600 AND 100000000
   ON CONFLICT (supplier_service_id) DO NOTHING
   RETURNING supplier_service_id
 ), retired AS (
   UPDATE public.litix_boostero_inventory AS old
     SET active=false,validation_state='DISCONTINUED',validation_reason='removed_from_supplier_catalog',refreshed_at=$2::timestamptz
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
        (SELECT count(*)::integer FROM activated) AS activated,
        (SELECT count(*)::integer FROM retired) AS marked_unavailable,
        (SELECT count(*)::integer FROM logged) AS audit_records
 `,[JSON.stringify(payload),timestamp,stats.retrieved,stats.valid,stats.invalid,autoPublish===true]);
 if(Number(rows[0]?.imported)!==items.length||Number(rows[0]?.audit_records)!==1)
  throw Error("inventory_atomic_write_unconfirmed");
 return {...stats,pricingReviewCount:payload.filter(x=>x.review).length,reasonCounts:validation.reasons,
   validationStates:payload.reduce((acc,x)=>(acc[x.state]=(acc[x.state]||0)+1,acc),{}),pricingMultiplier:2.5,imported:items.length,markedUnavailable:Number(rows[0]?.marked_unavailable||0),
  publicNewServicesEnabled:Number(rows[0]?.activated||0),checkoutAllowlistUnchanged:autoPublish!==true,syncedAt:timestamp,
  atomicCommitVerified:true};
}
