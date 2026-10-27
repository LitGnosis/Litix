import {boosteroProduction,boosteroCompatibleServices} from "./boosteroReadOnly.mjs";
import {boosteroSQL,boosteroQuote,boosteroProductionReady} from "./boosteroFulfillment.mjs";
// Read-only catalog requests are coalesced for 90 seconds to avoid hammering
// Boostero when SMMGLOB is unavailable. Paid order quotes ALWAYS use fresh
// supplier price and balance in boosteroFulfillment.mjs before dispatch.
let catalogCache=null,catalogExpires=0,catalogFlight=null;
async function liveCatalog(){
 if(catalogCache&&Date.now()<catalogExpires)return catalogCache;
 if(!catalogFlight)catalogFlight=boosteroProduction("services")
  .then(rows=>{const services=boosteroCompatibleServices(rows);catalogCache=services;catalogExpires=Date.now()+90000;return services})
  .finally(()=>{catalogFlight=null});
 return catalogFlight;
}
// Never publish from supplier API alone: both production enablement and explicit DB allowlist required.
export async function enabledBoosteroCards(){
 if(!boosteroProductionReady())return [];
 const sql=boosteroSQL();
 let rows;
 try{rows=await sql.query("select * from public.litix_boostero_services where enabled=true order by supplier_service_id limit 20");}
 catch{return []}
 if(!rows.length)return [];
 let live;
 try{live=await liveCatalog()}catch{return []}
 const cards=[];
 for(const approved of rows){
  const service=live.find(s=>s.id===approved.supplier_service_id);
  if(!service)continue;
  // $5 retail alone is insufficient when total supplier cost is below $1:
  // the global 8x wholesale floor still applies at that quantity.
  const retail=Number(approved.retail_per_1000_cents),wholesale=Number(service.wholesalePer1000USD);
  const floorQty=Math.max(Number(service.min),Math.ceil(500000/retail));
  const candidates=[floorQty,Math.max(floorQty,Math.ceil(1000/wholesale)),
    Math.max(floorQty,Math.ceil(20000/wholesale))].filter(q=>Number.isSafeInteger(q)&&q<=Number(service.max));
  let quantity=null,quote=null;
  for(const candidate of [...new Set(candidates)].sort((a,b)=>a-b)){
   try{quote=boosteroQuote({service,approved,quantity:candidate});quantity=candidate;break}catch{}
  }
  if(!quote||quantity===null)continue;
  const category=service.platform+" "+(service.kind==="followers"?"Followers":"Likes");
  cards.push({id:"boostero_"+service.id,name:service.name,category,platform:service.platform,
   type:"Default",kind:service.kind,min:quantity,supplierMin:Number(service.min),max:Number(service.max),unitStep:1,
   startingAmountCents:quote.amountCents,pricingReview:false,per1000:quote.retailPer1000Cents/100,
   refill:service.apiRefillEligible===true,noDrop:false,purchasable:true});
 }
 return cards;
}
export function filterBoosteroCards(items,params){
 const name=String(params.get("q")||"").toLowerCase(),kind=String(params.get("kind")||"").toLowerCase(),
  cat=String(params.get("category")||""),platform=String(params.get("platform")||"");
 return items.filter(s=>(!name||[s.id,s.name,s.category].some(x=>String(x).toLowerCase().includes(name)))&&
  (!cat||cat===s.category)&&(!platform||platform==="All platforms"||platform===s.platform)&&
  (!kind||kind===s.kind));
}
