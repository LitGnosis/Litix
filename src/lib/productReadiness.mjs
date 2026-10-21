// Product readiness is independent of gateway readiness: accepting payment alone
// does not establish that every advertised entitlement can be delivered.
export function bundleReadiness({missing=[],unredeemable=[],priceCents,estimatedCostCents}) {
  const blockers=[];
  if(missing.length)blockers.push({code:'MISSING_DELIVERY_ROUTES',items:[...missing]});
  if(unredeemable.length)blockers.push({code:'UNREDEEMABLE_QUANTITIES',items:[...unredeemable]});
  if(!Number.isSafeInteger(priceCents)||priceCents<=0||!Number.isSafeInteger(estimatedCostCents)||estimatedCostCents<0||priceCents<=estimatedCostCents)blockers.push({code:'PRICE_NOT_DELIVERABLE'});
  return {ready:blockers.length===0,blockers};
}
export function instagramOfferReadiness() {
  // No Instagram implementation exists in discoverRecent, and the current
  // scheduler debits a wallet per single service, not a prepaid 30-day bundle.
  // Credential presence must never turn these implementation checks green.
  return {ready:false,blockers:[
    {code:'INSTAGRAM_DISCOVERY_NOT_IMPLEMENTED'},
    {code:'PREPAID_LIKES_AND_VIDEO_VIEWS_NOT_IMPLEMENTED'},
    {code:'THIRTY_DAY_TERM_AND_DAILY_CAP_NOT_IMPLEMENTED'},
    {code:'VERIFIED_PRODUCT_PAYMENT_ACTIVATION_NOT_IMPLEMENTED'}
  ]};
}
export function productCheckoutReadiness({fulfillment,paymentReady,activationImplemented=false}) {
  return {ready:fulfillment.ready===true&&paymentReady===true&&activationImplemented===true,
    fulfillmentReady:fulfillment.ready===true,paymentReady:paymentReady===true,
    activationImplemented:activationImplemented===true};
}
