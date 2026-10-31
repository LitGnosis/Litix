import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroProductionReady} from "./boosteroFulfillment.mjs";
import {publicServiceCardName} from "./serviceCardDisplay.mjs";
import {matchesServiceQuickKind} from "./catalogSort.mjs";
import {litixRetailPer1000Cents,litixOrderCents,litixPurchasableDefault} from "./litixRetail60.mjs";
import {createResilientCatalogCache} from "./litixCatalogResilience.mjs";
export {litixPlatform,litixKind} from "./litixServiceClassify.mjs";
import {litixPlatform,litixKind} from "./litixServiceClassify.mjs";
async function fetchFreshBoosteroCards(){
 let raw;
 try{raw=await boosteroProduction("services")}
 catch(error){
  // A single bounded retry is safe only for this READ operation.
  if(!/boostero_(network|http_5[0-9][0-9]|invalid_json)/.test(String(error?.message||"")))throw error;
  await new Promise(resolve=>setTimeout(resolve,250));
  raw=await boosteroProduction("services");
 }
 const items=raw;
  const unique=new Map();
  for(const item of items){
   const supplierId=String(item?.service??"");
   if(!/^\d{1,12}$/.test(supplierId)||unique.has(supplierId))continue;
   const retailCents=litixRetailPer1000Cents(item.rate,item);
   const minimum=litixPurchasableDefault(item);
   if(!minimum||!retailCents)continue;
   const platform=litixPlatform(item.name,item.category),kind=litixKind(item.name,item.category);
   const name=String(item.name||"").slice(0,200);
   const category=String(item.category||"Other").slice(0,140);
   unique.set(supplierId,{
    id:"boostero_"+supplierId,name,category,platform,kind,type:"Default",
    min:minimum,supplierMin:Number(item.min),max:Number(item.max),unitStep:1,
    per1000:retailCents/100,startingAmountCents:litixOrderCents(retailCents,minimum),
    pricingReview:false,purchasable:true,
    refill:item.refill===true||String(item.refill)==="1",noDrop:false,
    pricingPolicy:"Boostero live cost + 60% markup",supplier:"Boostero"
   });
  }
 const rows=[...unique.values()];
 if(!rows.length)throw Error("catalog_empty_or_invalid");
 return rows;
}
const cache=createResilientCatalogCache({fetchFresh:fetchFreshBoosteroCards});
export async function allBoosteroCardsSnapshot(){
 if(!boosteroProductionReady())return {items:[],status:"unavailable"};
 return cache.read();
}
export async function allBoosteroCards(){
 return (await allBoosteroCardsSnapshot()).items;
}
export const enabledBoosteroCards=allBoosteroCards;
export function filterBoosteroCards(items,params){
 const q=String(params.get("q")||"").toLowerCase().replace(/^litix_(\d+)$/,"boostero_$1"),kind=String(params.get("kind")||"").toLowerCase(),
  cat=String(params.get("category")||""),platform=String(params.get("platform")||"");
 return items.filter(s=>(!q||[s.id,s.name,s.category,s.platform].some(x=>String(x).toLowerCase().includes(q)))&&
  (!cat||cat===publicServiceCardName({name:s.category}))&&(!platform||platform==="All platforms"||platform===s.platform)&&
  (!kind||(kind===s.kind&&matchesServiceQuickKind(s,kind))));
}
