// A savings claim may only be shown when live, purchasable card amounts prove it.
// Promo labels and discounts are never inferred from quantities alone.
const THRESHOLDS=Object.freeze({500:1,1000:1,2500:1,5000:1});
export function verifiedVolumeSavings(cards,quantity){
 const qty=Number(quantity);
 if(!Object.hasOwn(THRESHOLDS,qty)||!Array.isArray(cards))return null;
 const valid=cards.filter(x=>x?.available===true&&Number.isSafeInteger(x.quantity)&&
  x.quantity>0&&Number.isSafeInteger(x.totalCents)&&x.totalCents>=100);
 const item=valid.find(x=>x.quantity===qty);
 const base=valid.find(x=>x.quantity===100)||valid.find(x=>x.quantity===250)||
  valid.find(x=>x.quantity<qty);
 if(!item||!base||base.quantity>=qty)return null;
 // Use cents-based integer rounding so the visual badge matches the quote.
 const benchmark=Math.ceil(base.totalCents*qty/base.quantity-1e-8);
 const saved=benchmark-item.totalCents;
 const percent=Math.floor(100*saved/benchmark);
 if(saved<1||percent<THRESHOLDS[qty]||percent>90)return null;
 return percent;
}
export function verifiedSavingsDetails(cards,quantity){
 const percentage=verifiedVolumeSavings(cards,quantity);
 if(percentage===null)return null;
 const item=cards.find(x=>x.quantity===Number(quantity));
 const base=cards.find(x=>x.quantity===100&&x.available)||
  cards.find(x=>x.quantity===250&&x.available)||
  cards.find(x=>x.quantity<Number(quantity)&&x.available);
 if(!item||!base)return null;
 const benchmark=Math.ceil(base.totalCents*Number(quantity)/base.quantity-1e-8);
 const savedCents=benchmark-item.totalCents;
 return savedCents>0?{savedCents,percent:percentage}:null;
}
export function curatedQuantityBadge(cards,quantity,{live=false}={}){
 const qty=Number(quantity);
 const details=live?verifiedSavingsDetails(cards,qty):null;
 if(details!==null){
  const amount=(details.savedCents/100).toFixed(2);
  return `Save $${amount} (${details.percent}%)`;
 }
 if(qty===1000)return "FEATURED";
 if(qty===2500)return "MORE REACH";
 if(qty===5000)return "MAX REACH";
 return null;
}
