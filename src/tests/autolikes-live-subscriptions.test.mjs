import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {quoteAutoLikesMonth,subscriptionRequestId,upcomingBillingDate} from "../lib/autoLikesSubscriptions.mjs";
import {parseNmiTransactionEvidence,paidPeriodEnd} from "../lib/nmiQueryEvidence.mjs";
import {nmiRecurringStatus,parseRecurringGatewayResponse} from "../lib/nmiRecurring.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const campaign={id:"al_"+ "a".repeat(40),platform:"instagram",status:"draft",account_ref:"@testuser",service_catalog_id:"300",quantity_per_post:1000,max_posts_per_month:10};
const services=[{service:300,name:"Instagram Likes",category:"Instagram Likes",type:"Default",rate:"1.00",pricedRetail:8,min:100,max:100000}];
test("AutoLikes monthly plans always price from the latest supported supplier catalog",()=>{
 const quote=quoteAutoLikesMonth(campaign,services);
 assert.equal(quote.quantity,1000);
 assert.equal(quote.maxPosts,10);
 assert.equal(quote.monthlyCents,quote.perPostCents*10);
 assert.ok(quote.monthlyCents>=100);
 assert.throws(()=>quoteAutoLikesMonth({...campaign,status:"paused"},services));
 assert.throws(()=>quoteAutoLikesMonth({...campaign,max_posts_per_month:100},services));
 assert.throws(()=>quoteAutoLikesMonth({...campaign,service_catalog_id:"999"},services));
 assert.throws(()=>quoteAutoLikesMonth({...campaign,quantity_per_post:9999999},services));
});
test("subscription request ID is stable for idempotent repeat and changes for distinct requests",()=>{
 const id=campaign.id,k1="00000000-0000-4000-8000-000000000001",k2="00000000-0000-4000-8000-000000000002";
 assert.equal(subscriptionRequestId("auth0|abc",id,k1),subscriptionRequestId("auth0|abc",id,k1));
 assert.notEqual(subscriptionRequestId("auth0|abc",id,k1),subscriptionRequestId("auth0|abc",id,k2));
 assert.match(subscriptionRequestId("auth0|abc",id,k1),/^alsub_[a-f0-9]{48}$/);
 assert.equal(upcomingBillingDate(new Date("2026-10-31T12:00:00Z")).day,28);
});
const xml=(condition="complete",source="recurring",amount="15.99",sid="12345",success="1")=>`<nm_response><transaction>
<transaction_id>88330001</transaction_id><subscription_id>${sid}</subscription_id><condition>${condition}</condition>
<action><amount>${amount}</amount><action_type>sale</action_type><date>20261025120000</date>
<success>${success}</success><source>${source}</source></action></transaction></nm_response>`;
test("only settled NMI recurring sale with exact subscription and amount establishes payment proof",()=>{
 const ok=parseNmiTransactionEvidence(xml(),"12345",1599);
 assert.equal(ok.length,1);assert.equal(ok[0].transactionId,"88330001");
 assert.equal(ok[0].paidAt,"2026-10-25T12:00:00.000Z");
 for(const input of [xml("pending"),xml("complete","api"),xml("complete","recurring","16.99"),xml("complete","recurring","15.99","999"),xml("complete","recurring","15.99","12345","0")])
  assert.equal(parseNmiTransactionEvidence(input,"12345",1599).length,0);
 assert.throws(()=>parseNmiTransactionEvidence("not xml","12345",1599));
 assert.ok(new Date(paidPeriodEnd(ok[0].paidAt))>new Date(ok[0].paidAt));
});
test("a test-key flag cannot activate live recurring payments",()=>{
 const core={VERCEL_ENV:"production",NMI_SECURITY_KEY:"sample-merchant-key-123",NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY:"sample-public-collect-abc"};
 assert.equal(nmiRecurringStatus(core).ready,false);
 assert.equal(nmiRecurringStatus({...core,LITIX_NMI_RECURRING_LIVE_ENABLED:"true"}).ready,false);
 assert.equal(nmiRecurringStatus({...core,LITIX_NMI_RECURRING_LIVE_ENABLED:"true",LITIX_NMI_RECURRING_MERCHANT_APPROVED:"true"}).ready,true);
 assert.equal(parseRecurringGatewayResponse("response=1&response_code=100&subscription_id=556677").approved,true);
});
test("post dispatch is disabled unless all paid, source and fulfillment flags are enabled",()=>{
 const route=read("app/api/v2/cron/autolikes-dispatch/route.js");
 assert.match(route,/LITIX_AUTOLIKES_FULFILLMENT_ENABLED/);
 assert.match(route,/LITIX_AUTOLIKES_SOURCE_VERIFIED/);
 assert.match(route,/s.status='ACTIVE_PAID'/);
 assert.match(route,/b.verification_method='AUTHENTICATED_QUERY'/);
 assert.match(route,/w.consent_at is not null/);
 assert.match(route,/on conflict do nothing returning id/);
 assert.match(route,/UNKNOWN_OUTCOME/);
 assert.match(route,/month_key is distinct from/);
 assert.match(route,/action:"add"/);
 assert.match(route,/if\(!authorized\(request\)\)/);
});
test("enrollment ledger includes unique claims, consent, cancellation evidence and independent reconciliation",()=>{
 const migration=read("db/migrations/20261025-autolikes-live-enrollment-ledger.sql");
 assert.match(migration,/consent_at timestamptz/);
 assert.match(migration,/litix_autolikes_one_unreconciled_attempt/);
 assert.match(migration,/unique\(subscription_id\)/);
 const route=read("app/api/account/billing/route.js");
 assert.match(route,/sameOrigin\(req\)/);
 assert.match(route,/consentToMonthlyRenewal!==true/);
 assert.match(route,/const canEnroll=/);
 assert.match(route,/LITIX_AUTOLIKES_SOURCE_VERIFIED/);
 assert.match(route,/LITIX_AUTOLIKES_BILLING_RECONCILE_ENABLED/);
 assert.match(route,/if\(!canEnroll\(\)\)/);
 assert.match(route,/on conflict do nothing returning id/);
 assert.match(route,/return response\(\{status:"cancelled"/);
 assert.match(route,/UNKNOWN_OUTCOME/);
 const worker=read("app/api/v2/cron/autolikes-billing-reconcile/route.js");
 assert.match(worker,/paykings.transactiongateway.com\/api\/query.php/);
 assert.match(worker,/AUTHENTICATED_QUERY/);
 assert.match(worker,/new Date\(periodEnd\)>new Date\(\)/);
});
