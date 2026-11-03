import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {regularOrderHealthSignal,paymentOutboxHealthSignal} from "../lib/guardianSignals.mjs";
import {componentKeys} from "../lib/guardianCore.mjs";
const source=readFileSync(new URL("../lib/guardianRuntime.mjs",import.meta.url),"utf8");

test("old paid processing and submitted orders are visible even without a supplier ledger row",()=>{
 assert.equal(regularOrderHealthSignal({stale:0,unresolved:0,overdue:5}).code,"PAID_ORDERS_OVERDUE");
 const withReviews=regularOrderHealthSignal({stale:0,unresolved:2,overdue:5});
 assert.equal(withReviews.code,"PAID_ORDERS_NEED_REVIEW");
 assert.match(withReviews.detail,/5 paid orders overdue/);
 assert.equal(regularOrderHealthSignal({stale:0,unresolved:0,overdue:0}).ok,true);
 for(const value of [-1,"no",NaN])assert.equal(regularOrderHealthSignal({stale:0,unresolved:0,overdue:value}).ok,false);
 assert.match(source,/fulfillment_state in \('processing','submitted'\) and created_at<now\(\)-interval '24 hours'/);
 assert.match(source,/payment_state='paid' and fulfillment_state='manual_review'/);
});

test("PayKings pending events are never declared processed just because checkout previously settled",()=>{
 assert.equal(paymentOutboxHealthSignal({pending:3}).code,"PAYMENT_OUTBOX_UNRECONCILED");
 assert.equal(paymentOutboxHealthSignal({pending:0}).ok,true);
 assert.equal(paymentOutboxHealthSignal({pending:null}).ok,false);
 assert.equal(paymentOutboxHealthSignal({pending:-1}).ok,false);
 assert.match(source,/state='pending' and created_at<now\(\)-interval '1 hour'/);
 assert.ok(componentKeys.includes("payment_outbox"));
 assert.match(source,/payment_outbox:async\(\)=>/);
});

test("monitoring is read-only: no gateway capture, supplier purchases, queue or replay",()=>{
 const monitor=source.slice(source.indexOf("  fulfillment:async()=>{"),source.indexOf("  multi_post:async()=>{"));
 assert.ok(monitor.length>300);
 assert.match(monitor,/select count\(/);
 assert.doesNotMatch(monitor,/insert into|delete from|update public|boosteroProduction\(|fetch\(|paymentToken|dispatchBoostero/);
 assert.match(source,/never replay|Never replay/i);
});
