// Pricing is calculated only on verified server quotes. UI and charge paths
// use curatedRetailQuote, so an attractive package amount cannot drift at pay time.
export const CURATED_VOLUME_DISCOUNT_PERCENT=Object.freeze({2500:8,5000:15});
export const CURATED_FEATURED_POINTS_CENTS=Object.freeze([129,299,599,1099,2499,4499]);

export function curatedVolumeDiscountPercent(quantity){
 const qty=Number(quantity);
 if(!Number.isSafeInteger(qty)||qty<1)return 0;
 return qty>=5000?15:qty>=2500?8:0;
}

export function curatedPsychologicalCents(amount,minimum=100){
 if(!Number.isSafeInteger(amount)||amount<100||!Number.isSafeInteger(minimum)||minimum<100)return amount;
 const whole=Math.floor(amount/100);
 const candidates=new Set([...CURATED_FEATURED_POINTS_CENTS,whole*100+99,(whole+1)*100+99]);
 const tolerance=Math.min(500,Math.max(40,Math.round(amount*0.14)));
 const eligible=[...candidates].filter(n=>n>=minimum&&n>=100&&n<=100000000&&Math.abs(n-amount)<=tolerance);
 eligible.sort((a,b)=>Math.abs(a-amount)-Math.abs(b-amount)||a-b);
 return eligible[0]??amount;
}
function floorForKind(base){
 const k=String(base.kind||"").toLowerCase(),p=String(base.platform||"").toLowerCase();
 const rate=["instagram","tiktok"].includes(p)&&k==="followers"?900:
  ["instagram","tiktok"].includes(p)&&k==="likes"?600:300;
 return Math.ceil(rate*base.quantity/1000-1e-8);
}
export function curatedRetailQuote(base){
 if(!base||!Number.isSafeInteger(base.quantity)||base.quantity<1||
  !Number.isSafeInteger(base.retailPer1000Cents)||base.retailPer1000Cents<1||
  !Number.isFinite(base.costUSD)||base.costUSD<=0)throw Error("invalid_curated_quote");
 const normal=base.pricingRule==="nearest"?base.amountCents:Math.round(base.retailPer1000Cents*base.quantity/1000);
 // Preserve the 35% wholesale cushion, the $1 charge floor, and public retail
 // per-1k floors even if a rounded price or volume discount would undercut them.
 const floor=Math.max(100,Math.ceil(base.costUSD*135-1e-8),base.pricingRule==="nearest"?0:floorForKind(base));
 if(!Number.isSafeInteger(normal)||normal<floor)throw Error("curated_markup_floor");
 const target=curatedVolumeDiscountPercent(base.quantity);
 const discounted=Math.round(normal*(100-target)/100);
 const eligible=target>0&&discounted>=floor;
 const raw=eligible?discounted:normal;
 const amountCents=curatedPsychologicalCents(raw,floor);
 const applied=eligible&&amountCents<normal;
 return {...base,amountCents,pricingRule:"curated",
  volumeDiscountPercent:applied?Math.round((normal-amountCents)*100/normal):0};
}
export function curatedPreviewCents(retailUsdPer1000,quantity){
 const rate=Math.round(Number(retailUsdPer1000)*100);
 if(!Number.isSafeInteger(rate)||rate<1||!Number.isSafeInteger(quantity)||quantity<1)return null;
 const normal=Math.round(rate*quantity/1000);
 return Math.round(normal*(100-curatedVolumeDiscountPercent(quantity))/100);
}
