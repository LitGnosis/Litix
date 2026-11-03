import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {multiPostHealthSignal,regularOrderHealthSignal} from "../lib/guardianSignals.mjs";

const source=readFileSync(new URL("../lib/guardianRuntime.mjs",import.meta.url),"utf8");
const orderSource=readFileSync(new URL("../lib/boosteroOrderHandler.mjs",import.meta.url),"utf8");
const checkoutSource=readFileSync(new URL("../app/api/checkout/v1/route.js",import.meta.url),"utf8");
const pricingSource=readFileSync(new URL("../lib/litixRetail60.mjs",import.meta.url),"utf8");

test("recently polled canceled multi-post children are never marked healthy",()=>{
 assert.match(source,/state in \('UNKNOWN_OUTCOME','MANUAL_REVIEW'\)/);
 assert.match(source,/state='DISPATCHING' and updated_at<now\(\)-interval '20 minutes'/);
 assert.doesNotMatch(source,/state in \('DISPATCHING','UNKNOWN_OUTCOME','MANUAL_REVIEW'\) and updated_at<now\(\)-interval '20 minutes'/);
 assert.equal(multiPostHealthSignal({stale:0,unresolved:5,queued:0}).code,"MULTIPOST_REQUIRES_RECONCILIATION");
 assert.equal(multiPostHealthSignal({stale:0,unresolved:0,queued:0}).ok,true);
});

test("paid orders awaiting supplier reconciliation keep Guardian from reporting recovered",()=>{
 assert.match(source,/payment_state='paid' and fulfillment_state='manual_review'/);
 const result=regularOrderHealthSignal({stale:0,unresolved:2});
 assert.equal(result.ok,false);
 assert.equal(result.code,"PAID_ORDERS_NEED_REVIEW");
 assert.equal(regularOrderHealthSignal({stale:0,unresolved:0}).ok,true);
 assert.equal(regularOrderHealthSignal({stale:0,unresolved:"bad"}).code,"FULFILLMENT_HEALTH_INVALID");
});

test("payment and supplier protections stay unchanged",()=>{
 assert.match(checkoutSource,/Only available Litix services can be purchased/);
 assert.match(orderSource,/if\(Number\(data\?\.expectedAmountCents\)!==quote\.amountCents\)/);
 assert.match(orderSource,/idempotencyKey/);
 assert.match(orderSource,/supplier_order_id is null/);
 assert.match(pricingSource,/LITIX_RETAIL_MARKUP=1\.6/);
 assert.match(pricingSource,/LITIX_MINIMUM_CHARGE_CENTS=100/);
 assert.match(pricingSource,/LITIX_MIN_SOCIAL_LIKES_PER_1000_CENTS=600/);
 assert.match(pricingSource,/LITIX_MIN_SOCIAL_FOLLOWERS_PER_1000_CENTS=900/);
});
