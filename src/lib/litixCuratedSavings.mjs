// Display percentage savings only when achieved by real, server-authorized prices.
export function verifiedVolumeSavings(cards,quantity){
 const qty=Number(quantity);
 if(![2500,5000].includes(qty)||!Array.isArray(cards))return null;
 const base=cards.find(x=>x?.quantity===1000&&x.available===true);
 const large=cards.find(x=>x?.quantity===qty&&x.available===true);
 if(!base||!large||!Number.isSafeInteger(base.totalCents)||!Number.isSafeInteger(large.totalCents)||base.totalCents<100||large.totalCents<100)return null;
 const actual=100*(1-(large.totalCents*1000)/(base.totalCents*qty));
 const percent=Math.round(actual);
 return Number.isFinite(actual)&&percent>=(qty===2500?8:15)&&percent<=90?percent:null;
}
export function curatedQuantityBadge(cards,quantity,{live=false}={}){
 const qty=Number(quantity),pct=live?verifiedVolumeSavings(cards,qty):null;
 if(pct!==null)return qty===5000?`BEST VALUE · SAVE ${pct}%`:`SAVE ${pct}%`;
 if(qty===1000)return "FEATURED";
 if(qty===2500)return "MORE REACH";
 if(qty===5000)return "MAX REACH";
 return null;
}
