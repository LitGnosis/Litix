/**
 * Additive Boostero inventory synchronization; only called by authenticated
 * server route after the inventory migration is installed.
 * Never touches litix_boostero_services, customers, payments or orders.
 */
import {normalizeBoosteroCatalog} from "./boosteroGlobalCatalog.mjs";
export async function importBoosteroInventory(sql,raw,{now=new Date(),force=false}={}){
 if(!sql||typeof sql.query!=="function")throw Error("inventory_database_unavailable");
 const normalized=normalizeBoosteroCatalog(raw);
 const {items,stats}=normalized;
 // Fail closed on accidental partial, empty or malformed supplier responses.
 if(items.length<100||items.length/Math.max(raw.length,1)<0.95)throw Error("inventory_supplier_snapshot_incomplete");
 const timestamp=new Date(now).toISOString();
 const existing=await sql.query("select count(*)::integer as n, max(refreshed_at) as last_sync from public.litix_boostero_inventory");
 const previous=Number(existing[0]?.n||0),last=existing[0]?.last_sync;
 if(!force&&last&&Date.now()-new Date(last).getTime()<30*60*1000)
  return {skipped:"recent_successful_sync",...stats,previous};
 // A temporary outage must not deactivate large swaths of the existing catalog.
 const allowMarkInactive=previous===0||items.length>=Math.ceil(previous*0.85);
 if(!allowMarkInactive)throw Error("inventory_unexpected_catalog_shrink");
 const size=70;
 for(let at=0;at<items.length;at+=size){
  const batch=items.slice(at,at+size).map(x=>({
   id:x.id,name:x.name,category:x.category,platform:x.platform,kind:x.kind,type:x.type,
   rate:x.wholesalePer1000,min:x.min,max:x.max,refill:x.refill,cancel:x.cancel,
   dripfeed:x.dripfeed,refill_days:x.refillDays,compatible:x.supportedInputShape
  }));
  // Parse untrusted supplier data exclusively as bound JSON: never interpolate SQL.
  await sql.query(
   `insert into public.litix_boostero_inventory (
      supplier_service_id,service_name,supplier_category,platform,service_kind,order_type,
      wholesale_per_1000,minimum_quantity,maximum_quantity,refill_eligible,
      cancel_eligible,dripfeed_eligible,refill_days,standard_input_compatible,
      active,last_seen_at,refreshed_at)
    select x.id,x.name,x.category,x.platform,x.kind,x.type,x.rate,
      x.min,x.max,x.refill,x.cancel,x.dripfeed,x.refill_days,x.compatible,
      true,$2::timestamptz,$2::timestamptz
    from jsonb_to_recordset($1::jsonb) as x(
      id text,name text,category text,platform text,kind text,type text,
      rate numeric,min integer,max integer,refill boolean,cancel boolean,
      dripfeed boolean,refill_days integer,compatible boolean)
    on conflict(supplier_service_id) do update set
      service_name=excluded.service_name,
      supplier_category=excluded.supplier_category,
      platform=excluded.platform,
      service_kind=excluded.service_kind,
      order_type=excluded.order_type,
      wholesale_per_1000=excluded.wholesale_per_1000,
      minimum_quantity=excluded.minimum_quantity,
      maximum_quantity=excluded.maximum_quantity,
      refill_eligible=excluded.refill_eligible,
      cancel_eligible=excluded.cancel_eligible,
      dripfeed_eligible=excluded.dripfeed_eligible,
      refill_days=excluded.refill_days,
      standard_input_compatible=excluded.standard_input_compatible,
      active=true,
      last_seen_at=excluded.last_seen_at,
      refreshed_at=excluded.refreshed_at`,
   [JSON.stringify(batch),timestamp]
  );
 }
 // Only after EVERY batch succeeded; never remove historical inventory rows.
 const inactive=await sql.query(
  "update public.litix_boostero_inventory set active=false,refreshed_at=$1::timestamptz where active=true and last_seen_at<$1::timestamptz returning supplier_service_id",
  [timestamp]
 );
 await sql.query(
  "insert into public.litix_boostero_inventory_syncs(retrieved_count,valid_count,invalid_count,enabled_count,result,notes) values($1,$2,$3,$4,'success',$5)",
  [stats.retrieved,stats.valid,stats.invalid,0,"Staged inventory only: never automatically enabled for purchase"]
 );
 return {...stats,imported:items.length,markedUnavailable:inactive.length,publicNewServicesEnabled:0,
   checkoutAllowlistUnchanged:true,syncedAt:timestamp};
}
