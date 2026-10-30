// Customer-facing catalog contract: only verified, approved, ACTIVE Boostero
// listings may be advertised as purchasable in the production storefront.
// Historical numeric SMMGLOB listings remain in existing tracking/history.
import {sortServicesPer1000} from "./catalogSort.mjs";
import {filterBoosteroCards} from "./boosteroCatalog.mjs";

const CATEGORIES=["Instagram Followers","Instagram Likes","TikTok Followers","TikTok Likes"];
const CANONICAL_IDS=new Set(CATEGORIES);

export function buildActiveStorefrontCatalog(all,params){
 const list=(Array.isArray(all)?all:[]).filter(x=>
  /^boostero_\d+$/.test(String(x?.id||"")) &&
  x?.purchasable===true &&
  CANONICAL_IDS.has(String(x?.category||"")) &&
  Number.isFinite(Number(x?.per1000))&&Number(x.per1000)>0 &&
  Number.isSafeInteger(Number(x?.startingAmountCents))&&Number(x.startingAmountCents)>=100
 );
 const unique=[...new Map(list.map(x=>[String(x.id),x])).values()];
 const available=sortServicesPer1000(unique,null,s=>s.per1000);
 const filtered=filterBoosteroCards(available,params);
 const pageInput=Number(params.get("page")||1);
 const page=Number.isSafeInteger(pageInput)&&pageInput>0?Math.min(pageInput,100000):1;
 const size=24, items=filtered.slice((page-1)*size,page*size);
 const goal=String(params.get("goal")||"");
 const recommendations=goal==="Grow audience"?filtered.filter(x=>x.kind==="followers").slice(0,3):
  goal==="Increase engagement"?filtered.filter(x=>x.kind==="likes").slice(0,3):[];
 return {items,total:filtered.length,allCount:available.length,page,
  categories:CATEGORIES,recommendations,
  catalogStatus:available.length?"live":"unavailable",
  boosteroCatalogStatus:available.length?"live_allowlisted":"unavailable",
  message:available.length?undefined:"Verified services temporarily unavailable",
  boosteroOnly:true};
}
