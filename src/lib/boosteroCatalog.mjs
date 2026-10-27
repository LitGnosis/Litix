import {boosteroProduction,boosteroFollowers} from "./boosteroReadOnly.mjs";
import {boosteroSQL,boosteroQuote,boosteroProductionReady} from "./boosteroFulfillment.mjs";
// Never publish from supplier API alone: both production enablement and explicit DB allowlist required.
export async function enabledBoosteroCards(){
 if(!boosteroProductionReady())return [];
 const sql=boosteroSQL();
 let rows;
 try{rows=await sql.query("select * from public.litix_boostero_services where enabled=true order by supplier_service_id limit 20");}
 catch{return []}
 if(!rows.length)return [];
 let live;
 try{live=boosteroFollowers(await boosteroProduction("services"))}catch{return []}
 const cards=[];
 for(const approved of rows){
  const service=live.find(s=>s.id===approved.supplier_service_id);
  if(!service)continue;
  const quantity=Math.max(Number(service.min),Math.ceil(500000/Number(approved.retail_per_1000_cents)));
  let quote;
  try{quote=boosteroQuote({service,approved,quantity});}catch{continue}
  const category=service.platform+" Followers";
  cards.push({id:"boostero_"+service.id,name:service.name,category,platform:service.platform,
   type:"Default",min:quantity,supplierMin:Number(service.min),max:Number(service.max),unitStep:1,
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
  (!kind||kind==="followers"));
}
