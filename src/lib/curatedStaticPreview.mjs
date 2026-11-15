import {CORE_KINDS,CORE_PLATFORMS,CORE_QUANTITIES} from "../config/curatedServices.mjs";

// Public retail-only historical values from the Nov 14 verified Litix snapshot.
// Never expose supplier IDs or use an old quote to authorize a card charge.
const PREVIEW_RETAIL=Object.freeze({
 instagram_followers:{min:90,max:5000,per1000:11.02},
 instagram_likes:{min:166,max:15000,per1000:6.00},
 instagram_views:null,
 instagram_comments:{min:5,max:500,per1000:1755.60},
 tiktok_followers:{min:30,max:10000,per1000:33.43},
 tiktok_likes:{min:90,max:10000,per1000:11.02},
 tiktok_views:null,
 tiktok_comments:{min:5,max:250,per1000:504.18}
});
const quote=(rate,quantity)=>Math.ceil(Number(rate)*quantity/10-1e-8);
export const STATIC_CURATED_PREVIEW=Object.freeze(CORE_PLATFORMS.flatMap(platform=>
 CORE_KINDS.map(kind=>{
  const sku=platform.toLowerCase()+"_"+kind,source=PREVIEW_RETAIL[sku];
  return Object.freeze({
   id:"curated_"+sku+"_standard",sku,platform,kind,tier:"standard",
   name:platform+" "+kind[0].toUpperCase()+kind.slice(1),
   label:"High Quality · Litix retail pricing",
   preview:true,purchasable:false,observedAt:"2026-11-14",
   min:source?.min??100,max:source?.max??5000,unitStep:1,
   per1000:source?.per1000??null,pricingRule:"ceil",
   quantityCards:CORE_QUANTITIES.map(quantity=>({
    quantity,available:true,
    totalCents:source&&quantity>=source.min&&quantity<=source.max&&quote(source.per1000,quantity)>=100
     ?quote(source.per1000,quantity):null
   }))
  });
 })));
