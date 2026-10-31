// All standard link-and-quantity Boostero services are offered on the main
// Litix store. Unusual API types remain visible in /services for manual review.
import {sortServicesPer1000} from "./catalogSort.mjs";
import {filterBoosteroCards} from "./boosteroCatalog.mjs";
import {litixPublicCard} from "./publicLitixCatalog.mjs";
import {publicServiceCardName} from "./serviceCardDisplay.mjs";

export function buildActiveStorefrontCatalog(rows,params){
 const unique=new Map();
 for(const x of Array.isArray(rows)?rows:[]){
  if(!/^boostero_\d+$/.test(String(x?.id||""))||x?.purchasable!==true||
     !Number.isFinite(Number(x?.per1000))||Number(x.per1000)<=0||
     !Number.isSafeInteger(Number(x?.startingAmountCents))||Number(x.startingAmountCents)<100)continue;
  unique.set(x.id,x);
 }
 const all=sortServicesPer1000([...unique.values()],null,x=>x.per1000);
 const filtered=filterBoosteroCards(all,params);
 const requested=Number(params.get("page")||1);
 const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,100000):1;
 const size=24;
 const categories=[...new Set(all.map(x=>publicServiceCardName({name:x.category})))].sort();
 const goal=String(params.get("goal")||"");
 const recommendations=goal==="Grow audience"?filtered.filter(x=>x.kind==="followers").slice(0,3):
  goal==="Increase engagement"?filtered.filter(x=>x.kind==="likes").slice(0,3):[];
 return {
  items:filtered.slice((page-1)*size,page*size).map(litixPublicCard).filter(Boolean),total:filtered.length,allCount:all.length,page,
  categories,recommendations:recommendations.map(litixPublicCard).filter(Boolean),catalogStatus:all.length?"live":"unavailable",
  message:all.length?undefined:"Litix services are temporarily unavailable",
  minimumOrderCents:100
 };
}
