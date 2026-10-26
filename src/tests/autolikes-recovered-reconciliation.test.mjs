import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHmac} from "node:crypto";
import {parseNmiTransactionEvidence,paidPeriodEnd} from "../lib/nmiQueryEvidence.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const route=read("app/api/autolikes/reconcile/route.js");
const webhook=read("app/api/autolikes/paykings/route.js");
const supplier=read("lib/liveAutoLikes.mjs");
const checkout=read("app/api/[action]/route.js");
const report=({condition="complete",source="recurring",amount="10.00",sub="99801",id="22233",success="1"}={})=>
\`<nm_response><transaction><transaction_id>\${id}</transaction_id><subscription_id>\${sub}</subscription_id><condition>\${condition}</condition><action><source>\${source}</source><action_type>sale</action_type><success>\${success}</success><amount>\${amount}</amount><date>20261024120000</date></action></transaction></nm_response>\`;
test("restored Oct25 parser accepts only settled matching recurring payments",()=>{
 assert.equal(parseNmiTransactionEvidence(report(),"99801",1000).length,1);
 assert.equal(parseNmiTransactionEvidence(report({condition:"pendingsettlement"}),"99801",1000).length,0);
 assert.equal(parseNmiTransactionEvidence(report({source:"api"}),"99801",1000).length,0);
 assert.equal(parseNmiTransactionEvidence(report({sub:"other"}),"99801",1000).length,0);
 assert.equal(parseNmiTransactionEvidence(report({amount:"9.99"}),"99801",1000).length,0);
 assert.equal(parseNmiTransactionEvidence(report({success:"0"}),"99801",1000).length,0);
 assert.equal(paidPeriodEnd("2026-01-31T12:00:00.000Z"),"2026-02-28T12:00:00.000Z");
});
test("live webhook never grants subscription entitlement on a pending sale",()=>{
 assert.match(webhook,/awaitingSettledPaymentVerification:true/);
 assert.doesNotMatch(webhook,/from accepted where s.id=.*?ACTIVE/s);
 assert.match(webhook,/webhook-signature/);
});
test("NMI reconciliation is read-only to the provider and requires a proven paid settlement",()=>{
 assert.match(route,/api\/query.php/);
 assert.match(route,/parseNmiTransactionEvidence/);
 assert.match(route,/condition:"complete"/);
 assert.match(route,/source:"recurring"/);
 assert.match(route,/on conflict do nothing/);
 assert.match(route,/s.status<>'CANCELLED'/);
 assert.doesNotMatch(route,/api\/transact.php|recurring:"add_subscription"/);
});
test("supplier worker is SMMGLOB only and rejects preview ordering",()=>{
 assert.match(supplier,/SMMGLOB_API_KEY/);
 assert.doesNotMatch(supplier,/SMMFOLLOWOM|smmfollowom/i);
 assert.match(supplier,/VERCEL_ENV!=="production"/);
 assert.match(supplier,/UNKNOWN_OUTCOME/);
});
test("one-time checkout handler remains separate from subscription route",()=>{
 assert.match(checkout,/const publicOrderId/);
 assert.match(checkout,/async function smm/);
 assert.doesNotMatch(checkout,/litix_autolikes_live_subscriptions/);
});
