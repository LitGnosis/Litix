import test from "node:test";
import assert from "node:assert/strict";
import {principalFromVerifiedJwt,verifiedPrincipal,mayReadOwnOrder,mayReadAgencyOrder,mayManageAgencyOrder,mayViewAgencyWorkspace} from "../lib/litixAccountAuthorization.mjs";
import {checkRecurringEligibility,planSubscriptionTransition} from "../lib/litixSubscriptionPolicy.mjs";
import {readFileSync} from "node:fs";
const now=Math.floor(Date.now()/1000);
const iss="https://litix-auth-test.auth0.com/",aud="https://litix-api-test";
const customerA="auth0|memberA123",customerB="auth0|memberB456";
const jwt=sub=>({sub,iss,aud,exp:now+3600,nbf:now-1});
const checked=sub=>principalFromVerifiedJwt(jwt(sub),{signatureVerified:true,expectedIssuer:iss,expectedAudience:aud,now});
const member=(sub="auth0|memberA123",tenant="agency-AAA",role="member")=>({auth0_sub:sub,tenant_id:tenant,role,status:"active",revoked_at:null});

test("Auth0 principal requires verified signature and exactly matching issuer/audience/time",()=>{
 assert.throws(()=>principalFromVerifiedJwt(jwt(customerA),{expectedIssuer:iss,expectedAudience:aud,now}),/signature/);
 for(const claims of [
  {...jwt(customerA),iss:"https://attacker.invalid/"},
  {...jwt(customerA),aud:"https://attacker.invalid"},
  {...jwt(customerA),exp:now-2},
  {...jwt(customerA),nbf:now+900},
  {...jwt(customerA),sub:""}
 ]){
  assert.throws(()=>principalFromVerifiedJwt(claims,{signatureVerified:true,expectedIssuer:iss,expectedAudience:aud,now}));
 }
 const v=checked(customerA);
 assert.ok(verifiedPrincipal(v));
 assert.ok(Object.isFrozen(v));
 assert.equal(verifiedPrincipal({kind:"auth0",sub:customerA,issuer:iss,expiresAt:now+900}),false,
  "Plain JSON must not forge a server-verified session");
});

test("personal order access denies email-only matching and all other Auth0 subjects",()=>{
 const a=checked(customerA),b=checked(customerB),own={customer_auth0_sub:customerA,email:"shared@example.test"};
 assert.equal(mayReadOwnOrder(a,own),true);
 assert.equal(mayReadOwnOrder(b,own),false);
 assert.equal(mayReadOwnOrder(a,{email:"shared@example.test"}),false);
 assert.equal(mayReadOwnOrder(a,{customer_auth0_sub:customerB,email:"shared@example.test"}),false);
 assert.equal(mayReadOwnOrder(JSON.parse(JSON.stringify(a)),own),false);
});

test("two agencies are isolated regardless of spoofed membership/role/email",()=>{
 const a=checked(customerA),b=checked(customerB);
 const agencyAOrder={tenant_id:"agency-AAA",customer_auth0_sub:customerA};
 const agencyBOrder={tenant_id:"agency-BBB",customer_auth0_sub:customerB};
 assert.equal(mayReadAgencyOrder(a,agencyAOrder,member()),true);
 assert.equal(mayReadAgencyOrder(a,agencyBOrder,member()),false);
 assert.equal(mayReadAgencyOrder(b,agencyAOrder,member()),false);
 assert.equal(mayReadAgencyOrder(a,agencyAOrder,{...member(),status:"revoked"}),false);
 assert.equal(mayReadAgencyOrder(a,agencyAOrder,{...member(),revoked_at:"2026-10-28"}),false);
 assert.equal(mayReadAgencyOrder(a,agencyAOrder,{...member(),role:"superadmin"}),false);
 assert.equal(mayReadAgencyOrder(a,agencyAOrder,null),false);
 assert.equal(mayReadAgencyOrder(a,{tenant_id:null},member()),false);
 assert.equal(mayViewAgencyWorkspace(a,{tenant_id:"agency-AAA"},member()),true);
 assert.equal(mayViewAgencyWorkspace(a,{tenant_id:"agency-BBB"},member()),false);
 assert.equal(mayManageAgencyOrder(a,agencyAOrder,member()),false);
 assert.equal(mayManageAgencyOrder(a,agencyAOrder,member(customerA,"agency-AAA","admin")),true);
 assert.equal(mayManageAgencyOrder(a,agencyBOrder,member(customerA,"agency-AAA","owner")),false);
});

const eligible={
 product:{approved:true,active:true,supplierRecurringVerified:true,priceCents:599,interval:"monthly"},
 processor:{recurringAuthorized:true,merchantEligible:true},
 customer:{authenticated:true,auth0Sub:customerA},
 consent:{explicitRecurringConsent:true,acceptanceId:"consent_123456789",acceptedAt:now-50}
};
test("subscriptions deny unapproved supplier, processor, unauthenticated customer, missing consent and below $5",()=>{
 const good=checkRecurringEligibility(eligible);
 assert.equal(good.eligible,true);
 assert.equal(good.paymentEnabled,false);
 assert.equal(good.fulfillmentEnabled,false);
 for(const broken of [
  {...eligible,product:{...eligible.product,approved:false}},
  {...eligible,product:{...eligible.product,supplierRecurringVerified:false}},
  {...eligible,product:{...eligible.product,priceCents:499}},
  {...eligible,product:{...eligible.product,interval:"yearly"}},
  {...eligible,processor:{...eligible.processor,recurringAuthorized:false}},
  {...eligible,customer:{...eligible.customer,authenticated:false}},
  {...eligible,consent:{...eligible.consent,explicitRecurringConsent:false}}
 ]){
  const result=checkRecurringEligibility(broken);
  assert.equal(result.eligible,false);
  assert.ok(result.reasons.length>=1);
 }
});
test("subscription lifecycle only proposes transitions, never charges or fulfills",()=>{
 const no=planSubscriptionTransition({current:{state:"draft"},action:"request_checkout"});
 assert.equal(no.allowed,false);
 const yes=planSubscriptionTransition({current:{state:"draft"},action:"request_checkout",
  evidence:{eligibility:checkRecurringEligibility(eligible),userExplicitlyConfirmed:true}});
 assert.equal(yes.allowed,true);
 assert.equal(yes.nextState,"pending_payment");
 assert.equal(yes.noChargeAttempted,true);
 assert.equal(yes.noSupplierAttempted,true);
 const paid={gatewayWebhookVerified:true,gatewayMerchantAuthorized:true,supplierRecurringVerified:true,
   transactionId:"transaction_1234567",eventId:"event_1234567"};
 assert.equal(planSubscriptionTransition({current:{state:"pending_payment"},action:"payment_confirmed",evidence:paid}).nextState,"active");
 assert.equal(planSubscriptionTransition({current:{state:"pending_payment"},action:"payment_confirmed",evidence:{...paid,gatewayWebhookVerified:false}}).allowed,false);
 assert.equal(planSubscriptionTransition({current:{state:"pending_payment"},action:"payment_confirmed",evidence:paid,seenEventIds:["event_1234567"]}).allowed,false);
 assert.equal(planSubscriptionTransition({current:{state:"active"},action:"cancel_renewal",evidence:{customerServerAuthenticated:false}}).allowed,false);
 assert.equal(planSubscriptionTransition({current:{state:"active"},action:"cancel_renewal",evidence:{customerServerAuthenticated:true,customerOwnsSubscription:true}}).nextState,"cancel_at_period_end");
 assert.equal(planSubscriptionTransition({current:{state:"cancel_at_period_end"},action:"subscription_expired",evidence:{serverObservedExpired:true,periodEnd:now}}).nextState,"canceled");
 assert.equal(planSubscriptionTransition({current:{state:"cancel_at_period_end"},action:"resume",evidence:{customerServerAuthenticated:true,customerOwnsSubscription:true,recurringStillPermitted:true}}).nextState,"active");
 assert.equal(planSubscriptionTransition({current:{state:"canceled"},action:"payment_confirmed",evidence:paid}).allowed,false);
 assert.throws(()=>planSubscriptionTransition({current:{state:"alien"},action:"payment_confirmed",evidence:paid}));
});

test("new foundation cannot register a payment route or expose private records",()=>{
 const account=readFileSync(new URL("../lib/litixAccountAuthorization.mjs",import.meta.url),"utf8");
 const subscriptions=readFileSync(new URL("../lib/litixSubscriptionPolicy.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(account+subscriptions,/fetch\(|\bstripe\b|\bboosteroProduction\(|\bnew Request\(/i);
 assert.doesNotMatch(account+subscriptions,/SMMGLOB_API_KEY|NMI_SECURITY_KEY|BOOSTERO_API_KEY/);
 assert.ok(!account.includes("email===order.email"));
});
