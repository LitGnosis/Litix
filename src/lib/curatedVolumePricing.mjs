// Server-verified minimum 35% markup. Never trust buyer-supplied discount fields.
export const CURATED_VOLUME_DISCOUNT_PERCENT=Object.freeze({2500:8,5000:15});
export function curatedRetailQuote(base){
 if(!base||!Number.isSafeInteger(base.quantity)||base.quantity<1||
  !Number.isSafeInteger(base.retailPer1000Cents)||base.retailPer1000Cents<1||
  !Number.isFinite(base.costUSD)||base.costUSD<=0)throw Error("invalid_curated_quote");
 const normal=base.pricingRule==="nearest"?base.amountCents:Math.round(base.retailPer1000Cents*base.quantity/1000);
 const floor=Math.ceil(base.costUSD*135-1e-8);
 if(!Number.isSafeInteger(normal)||normal<100||normal<floor)throw Error("curated_markup_floor");
 const target=CURATED_VOLUME_DISCOUNT_PERCENT[base.quantity]||0;
 const discounted=Math.round(normal*(100-target)/100);
 const eligible=target>0&&discounted>=floor&&discounted>=100;
 return {...base,amountCents:eligible?discounted:normal,pricingRule:"curated",
  volumeDiscountPercent:eligible?target:0};
}
export function curatedPreviewCents(retailUsdPer1000,quantity){
 const rate=Math.round(Number(retailUsdPer1000)*100);
 if(!Number.isSafeInteger(rate)||rate<1||!Number.isSafeInteger(quantity)||quantity<1)return null;
 const normal=Math.round(rate*quantity/1000);
 return Math.round(normal*(100-(CURATED_VOLUME_DISCOUNT_PERCENT[quantity]||0))/100);
}
