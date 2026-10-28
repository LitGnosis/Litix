import {premiumDefaultServices,priceAt60Percent} from "./boosteroPremiumCatalog.mjs";
const UPSERT=String.raw`insert into public.litix_boostero_premium_catalog
 (supplier_service_id,platform,kind,service_name,category,wholesale_per_1000,retail_per_1000,
  supplier_min,supplier_max,storefront_min,quantity_step,api_refill,refill_days,
  supplier_claim_non_drop,verified_at)
 select x.id,x.platform,x.kind,x.name,x.category,x.wholesale,x.retail,x.supplier_min,
  x.supplier_max,x.storefront_min,x.step,x.refill,x.days,x.no_drop,now()
 from jsonb_to_recordset($1::jsonb) as
 x(id text,platform text,kind text,name text,category text,wholesale numeric,retail numeric,
  supplier_min integer,supplier_max integer,storefront_min integer,step integer,
  refill boolean,days integer,no_drop boolean)
 on conflict (supplier_service_id) do update set
  platform=excluded.platform,kind=excluded.kind,service_name=excluded.service_name,
  category=excluded.category,wholesale_per_1000=excluded.wholesale_per_1000,
  retail_per_1000=excluded.retail_per_1000,supplier_min=excluded.supplier_min,
  supplier_max=excluded.supplier_max,storefront_min=excluded.storefront_min,
  quantity_step=excluded.quantity_step,api_refill=excluded.api_refill,
  refill_days=excluded.refill_days,supplier_claim_non_drop=excluded.supplier_claim_non_drop,
  verified_at=excluded.verified_at,updated_at=now()
 where public.litix_boostero_premium_catalog.enabled=false`;
export async function syncPremiumCatalog({raw,sql,batchSize=50}){
 if(!Array.isArray(raw)||!sql||typeof sql.query!=="function")throw Error("invalid_supplier_catalog");
 const list=premiumDefaultServices(raw),source=new Map(raw.map(r=>[String(r.service??r.id),r]));
 if(!list.length)throw Error("no_eligible_supplier_catalog");
 let reviewed=0;
 for(let i=0;i<list.length;i+=batchSize){
  const batch=list.slice(i,i+batchSize).map(x=>{
   const id=x.id.slice("boostero_".length),original=source.get(id),rate=Number(original?.rate);
   if(!Number.isFinite(rate)||rate<=0||Math.abs(priceAt60Percent(rate,1000).per1000-x.per1000)>0.0000001)
    throw Error("verified_supplier_rate_mismatch");
   return {id,platform:x.platform,kind:x.kind,name:x.name,category:x.category,
    wholesale:rate,retail:x.per1000,supplier_min:x.supplierMin,supplier_max:x.max,
    storefront_min:x.min,step:x.unitStep,refill:x.refill,
    days:Number.isSafeInteger(x.refillDays)&&x.refillDays<=365?x.refillDays:null,
    no_drop:x.noDrop};
  });
  await sql.query(UPSERT,[JSON.stringify(batch)]);
  reviewed+=batch.length;
 }
 return {eligible:list.length,staged:reviewed,purchasingEnabled:false};
}
