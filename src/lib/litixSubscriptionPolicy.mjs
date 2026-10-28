/**
 * Draft-only pure planning rules for customer-controlled recurring services.
 * NO payment, supplier, DB, email or live subscription can be performed here.
 * All trusted evidence flags must be created by server-side authenticated and
 * verified gateway/supplier code in a later independently tested release.
 */
const STATES=new Set(["draft","pending_payment","active","past_due","cancel_at_period_end","canceled"]);
const validId=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{8,128}$/.test(x);
const cents=x=>Number.isSafeInteger(x)&&x>=500&&x<=100000000;
export function checkRecurringEligibility({product,processor,customer,consent}={}){
 const reasons=[];
 if(!product||product.approved!==true||product.active!==true||product.supplierRecurringVerified!==true)
  reasons.push("supplier_recurring_not_verified");
 if(!processor||processor.recurringAuthorized!==true||processor.merchantEligible!==true)
  reasons.push("processor_recurring_not_authorized");
 if(!customer||customer.authenticated!==true||!validId(customer.auth0Sub))
  reasons.push("customer_identity_not_verified");
 if(!consent||consent.explicitRecurringConsent!==true||!validId(consent.acceptanceId)||
  !Number.isSafeInteger(consent.acceptedAt)||consent.acceptedAt<1)
  reasons.push("explicit_recurring_consent_missing");
 if(!cents(product?.priceCents))reasons.push("recurring_amount_invalid_or_below_floor");
 if(!["monthly","weekly"].includes(product?.interval))reasons.push("billing_interval_unapproved");
 return Object.freeze({eligible:reasons.length===0,reasons,requiresVerifiedPayment:true,
  paymentEnabled:false,fulfillmentEnabled:false});
}

/** Returns a proposed transition. Caller performs DB updates with an
 * idempotency key and verifies gateway evidence independently. */
export function planSubscriptionTransition({current,action,evidence={},seenEventIds=[]}={}){
 const state=current?.state;
 if(!STATES.has(state))throw Error("unknown_subscription_state");
 if(!Array.isArray(seenEventIds))throw Error("invalid_idempotency_ledger");
 if(!["request_checkout","payment_confirmed","payment_failed","cancel_renewal","subscription_expired","resume"].includes(action))
  throw Error("unsupported_subscription_transition");
 const deny=reason=>Object.freeze({allowed:false,state,reason,noChargeAttempted:true,noSupplierAttempted:true});
 const permitted=next=>Object.freeze({allowed:true,previousState:state,nextState:next,
  noChargeAttempted:true,noSupplierAttempted:true});
 if(action==="request_checkout"){
  if(state!=="draft")return deny("not_draft");
  if(evidence.eligibility?.eligible!==true||evidence.userExplicitlyConfirmed!==true)
   return deny("recurring_terms_not_authorized");
  return permitted("pending_payment");
 }
 if(action==="payment_confirmed"){
  if(!["pending_payment","past_due"].includes(state))return deny("not_awaiting_payment");
  if(evidence.gatewayWebhookVerified!==true||evidence.gatewayMerchantAuthorized!==true||
   evidence.supplierRecurringVerified!==true||!validId(evidence.transactionId)||!validId(evidence.eventId)||
   seenEventIds.includes(evidence.eventId))return deny("unverified_or_replayed_payment_event");
  return permitted("active");
 }
 if(action==="payment_failed"){
  if(!["pending_payment","active"].includes(state))return deny("payment_state_cannot_fail");
  if(evidence.gatewayWebhookVerified!==true||!validId(evidence.eventId)||seenEventIds.includes(evidence.eventId))
   return deny("unverified_or_replayed_payment_event");
  return permitted("past_due");
 }
 if(action==="cancel_renewal"){
  if(!["active","past_due"].includes(state))return deny("not_cancellable_state");
  if(evidence.customerServerAuthenticated!==true||evidence.customerOwnsSubscription!==true)
   return deny("customer_authorization_required");
  return permitted("cancel_at_period_end");
 }
 if(action==="subscription_expired"){
  if(state!=="cancel_at_period_end")return deny("not_canceling");
  if(evidence.serverObservedExpired!==true||!Number.isSafeInteger(evidence.periodEnd))
   return deny("expiration_not_verified");
  return permitted("canceled");
 }
 if(action==="resume"){
  if(state!=="cancel_at_period_end")return deny("not_pending_cancel");
  if(evidence.customerServerAuthenticated!==true||evidence.customerOwnsSubscription!==true||
   evidence.recurringStillPermitted!==true)return deny("new_consent_or_eligibility_required");
  return permitted("active");
 }
 throw Error("unreachable");
}
