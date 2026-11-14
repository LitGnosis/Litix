import {VERIFIED_CHECKOUT_SEED} from "./litixCheckoutVerifiedSeed.mjs";
import {compareCheckoutCards,dedupeCheckoutCards,checkoutDisplay,cleanCheckoutTitle} from "./litixCheckoutDisplay.mjs";
export const CHECKOUT_PLATFORMS=Object.freeze(["Instagram","TikTok","YouTube","Facebook","Twitter (X)"]);
export const CHECKOUT_KINDS=Object.freeze(["followers","likes","subscribers","views","comments","shares","saves","retweets","plays","members","traffic","other"]);
const KIND_LABELS={followers:"Followers",likes:"Likes",subscribers:"Subscribers",views:"Views",comments:"Comments",shares:"Shares",saves:"Saves",retweets:"Retweets",plays:"Plays",members:"Members",traffic:"Traffic",other:"Other services"};
const MAX_PUBLIC_ITEMS=2500;

export function isCheckoutChoice(row,platform){
 return !!row&&/^litix_\d{1,12}$/.test(String(row.id||""))&&
  row.platform===platform&&typeof row.kind==="string"&&row.purchasable===true&&
  Number.isSafeInteger(Number(row.min))&&Number(row.min)>0&&
  Number.isSafeInteger(Number(row.max))&&Number(row.max)>=Number(row.min)&&
  Number.isFinite(Number(row.per1000))&&Number(row.per1000)>0&&
  Number.isSafeInteger(Number(row.startingAmountCents))&&Number(row.startingAmountCents)>=100&&
  Number.isSafeInteger(Number(row.unitStep||1))&&Number(row.unitStep||1)>0;
}
function dedupe(items,platform){
 const map=new Map();
 for(const source of Array.isArray(items)?items:[]){
  if(!isCheckoutChoice(source,platform))continue;
  const row={
   id:String(source.id),name:cleanCheckoutTitle(String(source.name||"Litix service").slice(0,150)),
   platform,kind:String(source.kind),
   min:Number(source.min),max:Number(source.max),
   unitStep:Number(source.unitStep||1),per1000:Number(source.per1000),
   startingAmountCents:Number(source.startingAmountCents),purchasable:true,
   ...(source.variantQuality?{variantQuality:String(source.variantQuality).slice(0,60)}:{}),
   ...(source.variantPace?{variantPace:String(source.variantPace).slice(0,60)}:{})
  };
  map.set(row.id,row);
  if(map.size>=MAX_PUBLIC_ITEMS)break;
 }
 return [...map.values()];
}
const orderKind=k=>{const i=CHECKOUT_KINDS.indexOf(k);return i<0?999:i};
export function choicesForPlatform(platform,sourceItems=VERIFIED_CHECKOUT_SEED.items){
 const current=CHECKOUT_PLATFORMS.includes(platform)?platform:"Instagram";
 const items=dedupeCheckoutCards(dedupe(sourceItems,current))
  .sort((a,b)=>orderKind(a.kind)-orderKind(b.kind)||compareCheckoutCards(a,b));
 const kinds=[...new Set(items.map(x=>x.kind))].sort((a,b)=>orderKind(a)-orderKind(b))
  .map(value=>({value,label:KIND_LABELS[value]||value,count:items.filter(x=>x.kind===value).length}));
 return {platform:current,platforms:CHECKOUT_PLATFORMS.map(name=>({name,
   count:(Array.isArray(sourceItems)?sourceItems:[]).filter(x=>x?.platform===name).length
 })),items,kinds,total:items.length,liveAvailability:false,
  catalogStatus:"static",observedAt:VERIFIED_CHECKOUT_SEED.observedAt,
  note:"Recently verified Litix packages are available for browsing. Final pricing and availability require a fresh check before payment."};
}
export function defaultKindFor(choices,wanted="followers"){
 if(choices?.kinds?.some(x=>x.value===wanted))return wanted;
 return choices?.kinds?.[0]?.value||"";
}
export function firstPackageFor(choices,kind){
 return (Array.isArray(choices?.items)?choices.items:[]).find(x=>x.kind===kind&&!checkoutDisplay(x).specialty)||null;
}
export function combineCheckoutChoices(platform,network,fallback=choicesForPlatform(platform)){
 const items=dedupe(network?.items,platform);
 if(!items.length)return {...fallback,liveAvailability:false,catalogStatus:"static",
  note:"Showing previously verified Litix packages. Live updates are temporarily unavailable; payment remains subject to fresh verification."};
 const result=choicesForPlatform(platform,items);
 return {...result,liveAvailability:network?.liveAvailability===true,
  catalogStatus:String(network?.catalogStatus||"cached"),
  observedAt:network?.observedAt||fallback.observedAt,
  note:String(network?.note||"Prices and eligibility are checked again before payment.").slice(0,240)};
}
