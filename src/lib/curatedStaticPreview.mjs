import {VERIFIED_CHECKOUT_SEED} from "./litixCheckoutVerifiedSeed.mjs";
import {CORE_KINDS,CORE_PLATFORMS,CORE_QUANTITIES} from "../config/curatedServices.mjs";
const snapshot=VERIFIED_CHECKOUT_SEED.items;
const dollarCents=(rate,qty)=>Math.ceil(Number(rate)*qty/10-1e-8);
const isEligible=(row,quantity)=>quantity>=row.min&&quantity<=row.max&&
 (quantity-row.min)%Number(row.unitStep||1)===0&&dollarCents(row.per1000,quantity)>=100;
function candidate(platform,kind){
 const options=snapshot.filter(s=>s.platform===platform&&s.kind===kind&&
  /\b(?:high quality|usa|premium)\b/i.test(s.name||"")&&
  !/\b(?:live stream|story|group|emoji|female|male|arabic|turkish)\b/i.test(s.name||""));
 return options.find(s=>isEligible(s,1000))||options[0]||null;
}
export const STATIC_CURATED_PREVIEW=Object.freeze(CORE_PLATFORMS.flatMap(platform=>
 CORE_KINDS.map(kind=>{
  const source=candidate(platform,kind);
  return Object.freeze({
   id:"curated_"+platform.toLowerCase()+"_"+kind+"_standard",
   platform,kind,tier:"standard",sku:platform.toLowerCase()+"_"+kind,
   name:platform+" "+kind[0].toUpperCase()+kind.slice(1),
   label:"Previously listed · Live availability checked before payment",
   preview:true,purchasable:false,
   min:source?.min??100,max:source?.max??5000,
   per1000:source?.per1000??null,unitStep:source?.unitStep??1,
   pricingRule:"ceil",
   quantityCards:CORE_QUANTITIES.map(quantity=>({
    quantity,
    available:true,
    totalCents:source&&isEligible(source,quantity)?dollarCents(source.per1000,quantity):null
   }))
  });
 })));
