// Owner-only read-only PayKings/NMI settlement verification.
// No webhook endpoint is accepted without an independently verified signature contract.
const tag=(xml,key)=>new RegExp("<"+key+">([^<]{0,180})</"+key+">","i").exec(xml)?.[1]?.trim()||"";
export function verifyOwnerQueryXml(xml,{orderId,transactionId,totalCents}){
 if(typeof xml!=="string"||xml.length>150000||/<!DOCTYPE|<!ENTITY/i.test(xml))return false;
 const matches=[...xml.matchAll(/<transaction>([\s\S]*?)<\/transaction>/gi)];
 if(matches.length!==1)return false;
 const t=matches[0][1], actions=[...t.matchAll(/<action>([\s\S]*?)<\/action>/gi)].map(x=>x[1]);
 const sale=actions.some(a=>tag(a,"action_type")==="sale"&&tag(a,"success")==="1"&&
  tag(a,"response_code")==="100"&&Math.round(Number(tag(a,"amount"))*100)===totalCents);
 const settle=actions.some(a=>tag(a,"action_type")==="settle"&&tag(a,"success")==="1");
 return tag(t,"transaction_id")===transactionId&&tag(t,"order_id")===orderId&&
  tag(t,"condition")==="complete"&&(!tag(t,"currency")||tag(t,"currency")==="USD")&&sale&&settle;
}
export async function verifyOwnerPaymentSettlement({orderId,transactionId,totalCents},{fetcher=fetch}={}){
 if(process.env.VERCEL_ENV!=="production"||process.env.LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED!=="true"||
  !process.env.NMI_SECURITY_KEY)return {settled:false,reason:"settlement_verification_not_enabled"};
 if(!/^low_[0-9a-f-]{36}$/.test(String(orderId))||!/^\d{5,32}$/.test(String(transactionId))||
   !Number.isSafeInteger(totalCents)||totalCents<500)return {settled:false,reason:"invalid_payment_reference"};
 let r,xml;
 try{
  r=await fetcher("https://paykings.transactiongateway.com/api/query.php",{method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,transaction_id:transactionId,report_type:"transaction"}),
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(11000)});
  if(!r.ok)return {settled:false,reason:"settlement_query_http_error"};
  xml=await r.text();
 }catch{return {settled:false,reason:"settlement_query_unavailable"}}
 const settled=verifyOwnerQueryXml(xml,{orderId,transactionId,totalCents});
 return {settled,reason:settled?"verified_settled":"unverified_or_unsettled"};
}
export function ownerCoveredCardTotal(wholesaleCents,percentBps,fixedCents){
 const bps=Number(percentBps),fixed=Number(fixedCents);
 if(!Number.isSafeInteger(wholesaleCents)||wholesaleCents<=0||
  !Number.isSafeInteger(bps)||bps<0||bps>=10000||!Number.isSafeInteger(fixed)||fixed<0||
  bps>1500||fixed>1000)throw Error("owner_card_fee_not_verified");
 // Fees are normally calculated against the TOTAL collected, not the
 // wholesale subtotal. Round UP to guarantee no accidental underfunding.
 const total=Math.ceil((wholesaleCents+fixed)*10000/(10000-bps));
 return {totalCents:total,feeCents:total-wholesaleCents};
}
