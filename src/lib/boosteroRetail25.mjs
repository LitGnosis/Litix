// Candidate prices only. Never charge, publish, or override historical approval.
export const BOOSTERO_RETAIL_MULTIPLIER = 2.5;
export const MIN_RETAIL_PER_1000_CENTS = 500;
const ceilDiv=(a,b)=>(a+b-1n)/b;
const micros=value=>{
 const text=String(value??"").trim();
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(text))return null;
 const [whole,fraction=""]=text.split(".");
 const scaled=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,"0"));
 return scaled>0n&&scaled<=1000000000000n?scaled:null;
};
export function boosteroRetailCandidate(wholesalePer1000,{maxPer1000Cents=null}={}){
 const wholesale=micros(wholesalePer1000);
 if(wholesale===null)return {retailCents:null,reviewReason:"invalid_wholesale_rate"};
 // Use fixed-point millionths of a dollar and exact integer rounding UP.
 const candidate=ceilDiv(wholesale*5n,20000n); // 2.5x, converted to cents
 const retailCents=Number(candidate>500n?candidate:500n);
 const oldMarkup=wholesale<1000000n?8n:wholesale<20000000n?5n:2n;
 const previouslyRequired=Number(ceilDiv(wholesale*oldMarkup,10000n));
 let reviewReason=retailCents<previouslyRequired?"existing_markup_floor_conflict":null;
 if(maxPer1000Cents!==null&&(!Number.isSafeInteger(maxPer1000Cents)||
    maxPer1000Cents<500||retailCents>maxPer1000Cents))
  reviewReason="approved_price_ceiling_conflict";
 return {retailCents,reviewReason};
}
