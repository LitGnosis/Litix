// No browser callback or query parameter is evidence of settled payment.
// The bridge is responsible for gateway Query API verification; this consumer
// requires its settled ledger AND the matching paid storefront payment order.
export function validateBundleSettlement(purchase,order,ledger) {
  const fail=()=>{throw new Error('Bundle settlement does not match purchase');};
  if(!purchase||!order||!ledger||purchase.payment_provider!=='paykings'||purchase.status!=='pending_payment')return fail();
  if(!purchase.customer_id||!purchase.email||!Number.isSafeInteger(Number(purchase.price_cents))||Number(purchase.price_cents)<=0)return fail();
  if(purchase.payment_reference!==order.id||ledger.order_id!==order.id||order.payment_provider!=='paykings'||order.payment_status!=='paid'||ledger.payment_state!=='settled')return fail();
  if(!/^\d{4,40}$/.test(String(ledger.gateway_transaction_id||''))||order.payment_reference!==ledger.gateway_transaction_id)return fail();
  if(ledger.currency!=='USD'||Number(ledger.amount_cents)!==Number(purchase.price_cents)||Number(order.retail_cents)!==Number(purchase.price_cents))return fail();
  if(order.customer_id!==purchase.customer_id||ledger.customer_id!==purchase.customer_id)return fail();
  const email=String(purchase.email).toLowerCase();
  if(String(order.customer_email||'').toLowerCase()!==email||String(ledger.billing_email||'').toLowerCase()!==email)return fail();
  return {purchaseId:purchase.id,orderId:order.id,transactionId:ledger.gateway_transaction_id};
}
export function exactBundleItems(items) {
  if(!items||typeof items!=='object'||Array.isArray(items)||!Object.keys(items).length)throw Error('Missing advertised bundle items');
  const allowed=new Set(['Likes','Views','Impressions','Shares','Saves','Reposts']);
  return Object.entries(items).map(([kind,quantity])=>{
    if(!allowed.has(kind)||!Number.isSafeInteger(quantity)||quantity<=0)throw Error('Invalid advertised bundle item');
    return {kind,quantity};
  });
}
