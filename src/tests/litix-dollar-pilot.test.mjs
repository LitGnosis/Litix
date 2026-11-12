import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync(new URL("../app/api/checkout/pilot/route.js",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/pilot/page.jsx",import.meta.url),"utf8");
const catalog=readFileSync(new URL("../app/api/catalog/v1/route.js",import.meta.url),"utf8");

test("pilot is a fixed-price first-party creative order, never an engagement resale",()=>{
 assert.match(route,/const USD_CENTS=100/);
 assert.match(route,/d\?\.product!=="website_preview"/);
 assert.match(page,/This is not a Likes, Followers, or Views purchase/);
 assert.doesNotMatch(route,/boostero|smmglob|smmxpert|supplierApiCalled|\/api\/v2\/order/i);
});
test("no charge unless enabled in production with a verified owned worker",()=>{
 assert.match(route,/LITIX_DOLLAR_PILOT_ENABLED/);
 assert.match(route,/process\.env\.VERCEL_ENV==="production"/);
 assert.match(route,/nodeReady\(sql\)/);
 assert.match(route,/owned=true AND enabled=true AND last_seen>NOW\(\)-INTERVAL '90 seconds'/);
});
test("idempotency reservation precedes NMI call and blocks all retries",()=>{
 const reserve=route.indexOf("INSERT INTO growth_ops.litix_owned_payment_intents");
 const call=route.indexOf('fetch(GATEWAY+"/api/transact.php"');
 assert.ok(reserve>0&&call>reserve);
 assert.match(route,/ON CONFLICT\(order_id\) DO NOTHING RETURNING order_id/);
 assert.match(route,/existing_pilot_order_use_status_link/);
 assert.match(route,/gateway_result_unknown_do_not_retry/);
 assert.match(page,/Never retry the same payment/);
});
test("payment does not dispatch until independent merchant settlement query",()=>{
 assert.match(route,/fetch\(GATEWAY\+"\/api\/query\.php"/);
 assert.match(route,/parseTag\(t,"condition"\)!=="complete"/);
 assert.match(route,/parseTag\(a,"action_type"\)==="settle"/);
 assert.match(route,/master_fulfillment_grants/);
 assert.match(route,/litix_nmi_settled_transactions/);
 assert.match(route,/litix_payment_dispatch_outbox/);
 assert.match(route,/state='awaiting_settlement'/);
});
test("cards are hosted by NMI, and legacy unfulfillable cards aren't charged",()=>{
 assert.match(page,/secure\.nmi\.com\/token\/Collect\.js/);
 assert.match(page,/CollectJS\.startPaymentRequest/);
 assert.doesNotMatch(page,/ccnumber:\s*\w+|cvv:\s*\w+\.value/);
 assert.match(catalog,/checkoutEnabled:false/);
 assert.match(catalog,/purchasable:false/);
});
