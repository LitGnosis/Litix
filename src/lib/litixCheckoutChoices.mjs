// Checkout-only public selection model. Supplier inventory and wholesale
// details never leave the server; this does not alter purchase eligibility.
import {sortServicesPer1000} from "./catalogSort.mjs";
import {litixPublicCard} from "./publicLitixCatalog.mjs";

export const CHECKOUT_PLATFORM_ORDER=Object.freeze([
 "Instagram","TikTok","YouTube","Facebook","Twitter (X)",
 "Spotify","Telegram","LinkedIn","Discord","Snapchat","Pinterest",
 "Twitch","Website Traffic","Reddit","Apple Music","Other"
]);
export const CHECKOUT_KIND_ORDER=Object.freeze([
 "followers","likes","subscribers","views","comments","shares","saves",
 "retweets","plays","members","traffic","other"
]);
export const checkoutKindLabel=kind=>(kind==="retweets"?"Retweets":
 kind==="other"?"Other Services":
 kind.charAt(0).toUpperCase()+kind.slice(1));

export function buildCheckoutChoices(rows,requestedPlatform="Instagram"){
 const valid=(Array.isArray(rows)?rows:[]).filter(s=>
  /^boostero_\d{1,12}$/.test(String(s?.id||""))&&
  s?.purchasable===true&&
  Number.isSafeInteger(Number(s.min))&&Number(s.min)>0&&
  Number.isSafeInteger(Number(s.max))&&Number(s.max)>=Number(s.min)&&
  Number.isFinite(Number(s.per1000))&&Number(s.per1000)>0&&
  Number.isSafeInteger(Number(s.startingAmountCents))&&Number(s.startingAmountCents)>=100&&
  typeof s.platform==="string"&&s.platform.length>0
 );
 const counts=new Map();
 for(const s of valid)counts.set(s.platform,(counts.get(s.platform)||0)+1);
 const platforms=[...counts].sort(([a],[b])=>{
  const rank=x=>{const n=CHECKOUT_PLATFORM_ORDER.indexOf(x);return n<0?CHECKOUT_PLATFORM_ORDER.length:n};
  return rank(a)-rank(b)||a.localeCompare(b);
 }).map(([name,count])=>({name,count}));
 const platform=platforms.some(p=>p.name===requestedPlatform)?requestedPlatform:
  platforms[0]?.name||"";
 const options=valid.filter(s=>s.platform===platform);
 const kinds=[...new Set(options.map(s=>String(s.kind||"other")))].sort((a,b)=>{
  const rank=x=>{const n=CHECKOUT_KIND_ORDER.indexOf(x);return n<0?CHECKOUT_KIND_ORDER.length:n};
  return rank(a)-rank(b)||a.localeCompare(b);
 }).map(value=>({value,label:checkoutKindLabel(value),count:options.filter(s=>(s.kind||"other")===value).length}));
 const items=sortServicesPer1000(options,null,s=>Number(s.per1000))
  .map(litixPublicCard).filter(Boolean).map(s=>({
   id:s.id,name:s.name,platform:s.platform,kind:s.kind||"other",
   min:s.min,max:s.max,unitStep:s.unitStep,per1000:s.per1000,
   startingAmountCents:s.startingAmountCents,purchasable:s.purchasable
  }));
 return {platforms,platform,kinds,items,total:items.length};
}
