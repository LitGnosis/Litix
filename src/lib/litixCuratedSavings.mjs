const THRESHOLDS=Object.freeze({1000:10,2500:18,5000:25});

export function verifiedVolumeSavings(cards,quantity){
 const qty=Number(quantity);
 if(!Object.hasOwn(THRESHOLDS,qty)||!Array.isArray(cards))return null;
 const valid=cards.filter(x=>x?.available===true&&Number.isSafeInteger(x.quantity)&&
  x.quantity>0&&Number.isSafeInteger(x.totalCents)&&x.totalCents>=100);
 const candidate=valid.find(x=>x.quantity===qty);
 const baseline=valid.find(x=>x.quantity<qty);
 if(!candidate||!baseline)return null;
 const pct=100*(1-(candidate.totalCents/candidate.quantity)/(baseline.totalCents/baseline.quantity));
 const rounded=Math.floor(pct+1e-8);
 return Number.isFinite(rounded)&&rounded>=THRESHOLDS[qty]&&rounded<=90?rounded:null;
}

export function curatedQuantityBadge(cards,quantity,{live=false}={}){
 const qty=Number(quantity);
 const verified=live?verifiedVolumeSavings(cards,qty):null;
 if(verified!==null)return qty===5000?`BEST VALUE · Save ${verified}%`:`Save ${verified}%`;
 if(qty===1000)return "FEATURED";
 if(qty===2500)return "MORE REACH";
 if(qty===5000)return "MAX REACH";
 return null;
}
