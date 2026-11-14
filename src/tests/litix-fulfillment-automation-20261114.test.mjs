import test from "node:test";
import assert from "node:assert/strict";
import {createHmac,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {
 verifyPayKingsWebhook,parsePaidWebhook,verifyCapturedLitixSale,
 issueTrackingToken,decodeTrackingToken
} from "../lib/litixFulfillmentSecurity.mjs";

const id="ltx2_11111111-2222-4333-8444-555555555555",transactionId="1234567890";
const signingKey="unit-test-merchant-webhook-signing-key-long";
const hmacKey="unit-test-private-tracking-key-32-characters";
const raw=overrides=>JSON.stringify({
 event_id:randomUUID(),event_type:"transaction.sale.success",
 event_body:{
  features:{is_test_mode:false},transaction_type:"cc",order_id:id,
  transaction_id:transactionId,condition:"pendingsettlement",currency:"USD",
  requested_amount:"11.02",action:{amount:"11.02",action_type:"sale",success:"1",response_code:"100"},
  ...overrides
 }
});
const source=async p=>readFile(new URL(p,import.meta.url),"utf8");

test("NMI signed event validates exact raw bytes, tampering and wrong keys fail",()=>{
 const body=raw({});
 const nonce="a1b2c3d4e5";
 const signature=createHmac("sha256",signingKey).update(nonce+"."+body).digest("hex");
 assert.equal(verifyPayKingsWebhook(body,"t="+nonce+",s="+signature,signingKey),true);
 assert.equal(verifyPayKingsWebhook(body+" ","t="+nonce+",s="+signature,signingKey),false);
 assert.equal(verifyPayKingsWebhook(body,"t="+nonce+",s="+signature,"wrongwrongwrongwrongwrongwrongwrong"),false);
 assert.equal(verifyPayKingsWebhook(body,"",signingKey),false);
 assert.equal(verifyPayKingsWebhook(body,"t="+nonce+",s="+signature.slice(1),signingKey),false);
});

test("NMI official nested sale action gives exact captured amount and filters invalid events",()=>{
 const parsed=parsePaidWebhook(raw({}));
 assert.ok(parsed);
 assert.equal(parsed.orderId,id);
 assert.equal(parsed.transactionId,transactionId);
 assert.equal(parsed.amountCents,1102);
 assert.equal(parsed.type,"transaction.sale.success");
 assert.equal(parsePaidWebhook(raw({features:{is_test_mode:true}})),null);
 assert.equal(parsePaidWebhook(raw({action:{amount:"11.02",success:"0",response_code:"200",action_type:"sale"}})),null);
 assert.equal(parsePaidWebhook(raw({action:{amount:"12.02",success:"1",response_code:"100",action_type:"sale"},requested_amount:"11.02"}))?.amountCents,1202);
 assert.equal(parsePaidWebhook(raw({transaction_type:"echeck"})),null);
 assert.equal(parsePaidWebhook("not-json"),null);
});

test("Gateway query independently confirms captured sale, matching amount, order and transaction",async()=>{
 const xml=(order=id,amount="11.02",action="sale")=>`<response><transaction><transaction_id>${transactionId}</transaction_id><order_id>${order}</order_id><currency>USD</currency><transaction_type>cc</transaction_type><condition>pendingsettlement</condition><action><action_type>${action}</action_type><success>1</success><response_code>100</response_code><amount>${amount}</amount></action></transaction></response>`;
 const query=(response)=>verifyCapturedLitixSale({orderId:id,transactionId,amountCents:1102,securityKey:"test-security-key-123456789",fetcher:async()=>({ok:true,text:async()=>response})});
 assert.equal(await query(xml()),true);
 assert.equal(await query(xml(id,"10.99")),false);
 assert.equal(await query(xml("ltx2_99999999-2222-4333-8444-555555555555")),false);
 assert.equal(await query(xml(id,"11.02","auth")),false);
 assert.equal(await query("<response/>"),false);
});

test("private signed token is authenticated and never exposes a plain email",()=>{
 const token=issueTrackingToken(id,hmacKey);
 assert.ok(token.startsWith("v1."));
 assert.equal(decodeTrackingToken(token,hmacKey),id);
 assert.equal(decodeTrackingToken(token+"a",hmacKey),null);
 assert.equal(decodeTrackingToken(token,hmacKey+"changed"),null);
 assert.equal(decodeTrackingToken("v1.invalid.abc",hmacKey),null);
 assert.equal(issueTrackingToken(id,hmacKey),token);
});

test("existing one-way supplier claims, live link validation and safeties remain in place",async()=>{
 const [original,automation,webhook,services,refill,migration,vercel]=await Promise.all([
  source("../lib/boosteroFulfillment.mjs"),source("../lib/litixFulfillmentAutomation.mjs"),
  source("../app/api/webhooks/paykings/route.js"),source("../app/api/cron/sync-services/route.js"),
  source("../app/api/orders/refill/route.js"),source("../db/migrations/20261114-litix-paykings-fulfillment-automation.sql"),
  source("../vercel.json")
 ]);
 assert.match(original,/state='QUEUED'/);
 assert.match(original,/state='DISPATCHING'/);
 assert.match(original,/UNKNOWN_OUTCOME/);
 assert.match(original,/verifyBoosteroQuote/);
 assert.match(original,/boosteroDestination/);
 assert.match(automation,/safePreDispatch/);
 assert.match(automation,/max_safe_attempts_reached/);
 assert.match(automation,/estimated_supplier_credit_usd/);
 assert.match(automation,/sendPendingAdminReviews/);
 assert.match(webhook,/verifyPayKingsWebhook/);
 assert.match(webhook,/verifyCapturedLitixSale/);
 assert.doesNotMatch(webhook,/new URLSearchParams\(\{key:.*action:"add"/);
 assert.match(services,/boosteroProduction\("services"\)/);
 assert.match(services,/active=false/);
 assert.match(refill,/LITIX_AUTOMATED_REFILL_ENABLED/);
 assert.match(refill,/on conflict do nothing returning litix_order_id/);
 assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS litix_paid_transaction_unique/);
 assert.match(migration,/litix_paykings_webhook_events/);
 assert.match(migration,/litix_automation_reviews/);
 const schedules=JSON.parse(vercel).crons;
 assert.equal(schedules.find(x=>x.path==="/api/cron/sync-orders")?.schedule,"*/2 * * * *");
 assert.equal(schedules.find(x=>x.path==="/api/cron/sync-services")?.schedule,"10 3 * * *");
 assert.ok(!JSON.stringify(schedules).includes("retired supplier"));
});
