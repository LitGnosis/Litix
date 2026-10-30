// One pricing policy for the Litix public directory and live supplier checkout.
// A 60% markup means 1.6x the supplier's price (NOT a 60% gross margin).
export const LITIX_RETAIL_MARKUP=1.6;
export const LITIX_MINIMUM_CHARGE_CENTS=100;
const finitePositive=n=>Number.isFinite(n)&&n>0;
export const litixRetailPer1000Cents=rate=>{
 const n=Number(rate);
 if(!finitePositive(n)||n>1000000)return null;
 return Math.ceil(n*LITIX_RETAIL_MARKUP*100-1e-8);
};
export const litixOrderCents=(retailPer1000Cents,quantity)=>{
 const q=Number(quantity);
 if(!Number.isSafeInteger(q)||q<1||!Number.isSafeInteger(retailPer1000Cents)||retailPer1000Cents<1)return null;
 const total=Math.ceil(q*retailPer1000Cents/1000-1e-8);
 return Number.isSafeInteger(total)?total:null;
};
export const litixServiceMinimum=(min,max,per1000Cents)=>{
 if(!Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||
    !Number.isSafeInteger(per1000Cents)||per1000Cents<1)return null;
 const q=Math.max(min,Math.ceil((LITIX_MINIMUM_CHARGE_CENTS*1000)/per1000Cents-1e-9));
 return q<=max&&litixOrderCents(per1000Cents,q)>=LITIX_MINIMUM_CHARGE_CENTS?q:null;
};
export const litixPurchasableDefault=x=>{
 const type=String(x?.type??"");
 const id=String(x?.service??x?.id??"");
 const per1000Cents=litixRetailPer1000Cents(x?.rate);
 const min=Number(x?.min),max=Number(x?.max);
 const minimum=litixServiceMinimum(min,max,per1000Cents);
 return /^default$/i.test(type)&&/^\d{1,12}$/.test(id)&&minimum!==null&&max<=1000000?minimum:null;
};
export const litixSupplierSafeLink=value=>{
 let url;try{url=new URL(String(value??"").trim())}catch{return null}
 if(url.protocol!=="https:"||url.username||url.password||url.port||url.href.length>1100)return null;
 const h=url.hostname.toLowerCase();
 if(!h.includes(".")||h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||
    h.endsWith(".internal")||/^\d+\.\d+\.\d+\.\d+$/.test(h)||h.startsWith("[")||
    /\s/.test(url.href))return null;
 url.hash="";
 return url.href;
};
