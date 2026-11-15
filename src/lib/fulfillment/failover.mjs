// Safe financial calculation only. Does NOT issue refunds or place supplier orders.
// A timeout/unknown response may mean the supplier accepted the original order.
export function proposedProratedCreditCents({paidCents,quantity,remains}){
 if(![paidCents,quantity,remains].every(Number.isSafeInteger)||
    paidCents<0||quantity<=0||remains<0||remains>quantity)
  return null;
 return Number((BigInt(paidCents)*BigInt(remains)+BigInt(quantity)/2n)/BigInt(quantity));
}
export function assessSupplierRecovery({state,quantity,remains,paidCents,backupServiceId}){
 const orderState=String(state||"").toUpperCase();
 if(!["CANCELED","CANCELLED","PARTIAL","FAILED"].includes(orderState))
  return {action:"NONE",creditCents:null,requiresReview:orderState==="UNKNOWN_OUTCOME"};
 const creditCents=proposedProratedCreditCents({quantity,remains,paidCents});
 if(creditCents===null)return {action:"MANUAL_REVIEW",creditCents:null,requiresReview:true,
  reason:"No verified undelivered quantity"};
 const suggestedBackup=/^\d{1,12}$/.test(String(backupServiceId||""))?String(backupServiceId):null;
 // Approval and independent evidence that the original order is terminal are
 // mandatory before a replacement is created. Never auto-redispatch blindly.
 return {action:"MANUAL_REVIEW",creditCents,requiresReview:true,
  suggestedBackup,reason:"Verify final supplier outcome and reconcile PayKings before recovery"};
}
