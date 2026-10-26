import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {parseNmiTransactionEvidence,paidPeriodEnd,parseNmiUtc} from "../lib/nmiQueryEvidence.mjs";

const xml=({id="87654",txn="90012345",condition="complete",source="recurring",action="sale",success="1",amount="12.34",date="20261025123500"}={})=>
 `<?xml version="1.0" encoding="UTF-8"?><nm_response><transaction>
 <transaction_id>${txn}</transaction_id><subscription_id>${id}</subscription_id>
 <condition>${condition}</condition><action><amount>${amount}</amount>
 <action_type>${action}</action_type><date>${date}</date><success>${success}</success>
 <source>${source}</source></action></transaction></nm_response>`;
test("NMI Query API parser confirms only matching settled recurring transactions",()=>{
 const expected=parseNmiTransactionEvidence(xml(),"87654",1234);
 assert.deepEqual(expected,[{transactionId:"90012345",subscriptionId:"87654",paidAt:"2026-10-25T12:35:00.000Z"}]);
 assert.equal(parseNmiTransactionEvidence(xml(),"other",1234).length,0);
 assert.equal(parseNmiTransactionEvidence(xml({id:"wrong"}),"87654",1234).length,0);
 assert.equal(parseNmiTransactionEvidence(xml({condition:"pendingsettlement"}),"87654",1234).length,0);
 assert.equal(parseNmiTransactionEvidence(xml({source:"api"}),"87654",1234).length,0);
 assert.equal(parseNmiTransactionEvidence(xml({action:"auth"}),"87654",1234).length,0);
 assert.equal(parseNmiTransactionEvidence(xml({success:"0"}),"87654",1234).length,0);
 assert.equal(parseNmiTransactionEvidence(xml({amount:"12.33"}),"87654",1234).length,0);
 assert.equal(parseNmiTransactionEvidence(xml({date:"not-a-date"}),"87654",1234).length,0);
 assert.throws(()=>parseNmiTransactionEvidence("response=1","87654",1234),/Invalid NMI/);
});
test("billing cycle follows calendar months and clamps short months",()=>{
 assert.equal(paidPeriodEnd("2026-01-31T14:00:00.000Z"),"2026-02-28T14:00:00.000Z");
 assert.equal(paidPeriodEnd("2028-01-31T14:00:00.000Z"),"2028-02-29T14:00:00.000Z");
 assert.equal(paidPeriodEnd("2026-12-31T00:00:00.000Z"),"2027-01-31T00:00:00.000Z");
 assert.equal(paidPeriodEnd("2026-10-25T12:00:00.000Z"),"2026-11-25T12:00:00.000Z");
 assert.equal(parseNmiUtc("20261301120000"),null);
});
test("live recurring endpoints never assume a provider response is a paid subscription",()=>{
 const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const billing=get("app/api/account/billing/route.js"),reconcile=get("app/api/v2/cron/autolikes-reconcile/route.js"),dispatch=get("app/api/v2/cron/autolikes-dispatch/route.js");
 const migration=get("db/migrations/20261025-autolikes-live-enrollment-ledger.sql");
 assert.match(billing,/consentToMonthlyRenewal!==true/);
 assert.match(billing,/consentToPostMonitoring!==true/);
 assert.match(billing,/on conflict do nothing returning id/);
 assert.match(billing,/UNKNOWN_OUTCOME/);
 assert.match(billing,/status:"pending_payment_verification"/);
 assert.match(reconcile,/report_type:"transaction"/);
 assert.match(reconcile,/source:"recurring"/);
 assert.match(get("lib/nmiQueryEvidence.mjs"),/tag\(row,"condition"\)!=="complete"/);
 assert.match(reconcile,/AUTHENTICATED_QUERY/);
 assert.match(reconcile,/status='ACTIVE_PAID'/);
 assert.match(reconcile,/monitoring_consent_at/);
 assert.doesNotMatch(reconcile,/recurring:"add_subscription"/);
 assert.match(dispatch,/s\.status='ACTIVE_PAID'/);
 assert.match(dispatch,/LITIX_AUTOLIKES_SOURCE_VERIFIED/);
 assert.match(dispatch,/UNKNOWN_OUTCOME/);
 assert.match(dispatch,/on conflict do nothing returning id/);
 assert.match(migration,/unique\(customer_id,campaign_id,request_key\)/);
 assert.match(migration,/litix_autolikes_one_unreconciled_attempt/);
});
