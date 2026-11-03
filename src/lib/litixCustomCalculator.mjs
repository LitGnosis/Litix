// Public-price preview only. All paid orders get an independent live supplier
// quote before card authorization. Never calculate from wholesale credentials.
export const CUSTOM_MAX_POSTS=5;
export const CUSTOM_MAX_TOTAL_UNITS=1000000;
export const CUSTOM_MIN_CHARGE_CENTS=100;
export function customPublicCardValid(card,product){
 const rate=Number(card?.per1000),minimum=Number(card?.min),maximum=Number(card?.max);
 return card?.id===product?.id&&card?.platform===product?.platform&&
  card?.kind===product?.kind&&card?.purchasable===true&&
  Number.isFinite(rate)&&rate>0&&rate<1000000&&
  Number.isSafeInteger(minimum)&&minimum>0&&
  Number.isSafeInteger(maximum)&&maximum>=minimum&&maximum<=1000000&&
  Number.isSafeInteger(Number(card.unitStep||1))&&Number(card.unitStep||1)>0;
}
export const customRateCents=card=>{
 const n=Number(card?.per1000);
 if(!Number.isFinite(n)||n<=0)return null;
 const cents=Math.round(n*100);
 return Number.isSafeInteger(cents)&&Math.abs(n*100-cents)<1e-5?cents:null;
};
export function customQuantityCents(card,quantity){
 const q=Number(quantity),min=Number(card?.min),max=Number(card?.max),
  step=Number(card?.unitStep||1),rate=customRateCents(card);
 if(!Number.isSafeInteger(q)||q<min||q>max||
    !Number.isSafeInteger(step)||step<1||(q-min)%step!==0||!rate)return null;
 const cents=Math.ceil(rate*q/1000-1e-8);
 return Number.isSafeInteger(cents)&&cents>=CUSTOM_MIN_CHARGE_CENTS?cents:null;
}
export function customPriceQuote(card,quantities,kind){
 const numbers=Array.isArray(quantities)?quantities:[];
 const multi=kind==="likes",max=multi?CUSTOM_MAX_POSTS:1;
 if(!numbers.length||numbers.length>max)return {valid:false,totalCents:null,totalUnits:0,lines:[]};
 let totalCents=0,totalUnits=0;const lines=[];
 for(const quantity of numbers){
  const cents=customQuantityCents(card,quantity);
  if(cents===null)return {valid:false,totalCents:null,totalUnits:0,lines:[]};
  totalCents+=cents;totalUnits+=Number(quantity);
  if(!Number.isSafeInteger(totalCents)||totalUnits>CUSTOM_MAX_TOTAL_UNITS)
   return {valid:false,totalCents:null,totalUnits:0,lines:[]};
  lines.push(cents);
 }
 return {valid:true,totalCents,totalUnits,lines};
}
