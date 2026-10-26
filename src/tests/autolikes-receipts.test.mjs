import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route=readFileSync(new URL("../app/api/autolikes/receipts/route.js",import.meta.url),"utf8");
const settlement=readFileSync(new URL("../app/api/autolikes/reconcile/route.js",import.meta.url),"utf8");
const billing=readFileSync(new URL("../app/api/account/billing/route.js",import.meta.url),"utf8");
test("AutoLikes-only receipt requires cron authorization and production entitlement",()=>{
 assert.match(route,/authorized\(req\)/);
 assert.match(route,/LITIX_AUTOLIKES_RECEIPTS_ENABLED/);
 assert.match(route,/VERCEL_ENV!=="production"/);
 assert.match(route,/RESEND_API_KEY/);
 assert.match(route,/AUTHENTICATED_SETTLED_RECURRING_SALE/);
});
test("duplicate NMI payment events cannot create duplicate emails",()=>{
 assert.match(route,/litix_autolikes_receipt_attempts/);
 assert.match(route,/on conflict do nothing returning event_id/);
 assert.match(route,/Idempotency-Key/);
 assert.match(route,/UNKNOWN_OUTCOME/);
 assert.doesNotMatch(route,/api\/transact.php|action:"add"/);
 assert.match(settlement,/AUTHENTICATED_SETTLED_RECURRING_SALE/);
});
test("billing records and existing ordinary checkout remain separate",()=>{
 assert.match(billing,/litix_autolikes_live_gateway_events/);
 assert.doesNotMatch(route,/litix_regular_orders|litix_order_payments/);
});
