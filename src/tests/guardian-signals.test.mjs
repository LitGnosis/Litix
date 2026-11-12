import test from "node:test";
import assert from "node:assert/strict";
import {boosteroBalanceSignal,multiPostHealthSignal,deliveryNotificationSignal,regularOrderHealthSignal} from "../lib/guardianSignals.mjs";
test("Boostero-only wallet probe fails closed without credentials or valid numeric result",()=>{
 assert.equal(boosteroBalanceSignal({balance:"80.50"}).ok,true);
 assert.equal(boosteroBalanceSignal({balance:"49.99"}).code,"BOOSTERO_WALLET_LOW");
 for(const balance of [undefined,null,"",NaN,-1])assert.equal(boosteroBalanceSignal({balance}).ok,false);
 assert.doesNotMatch(JSON.stringify(boosteroBalanceSignal({balance:12})) ,/12/); // never expose wholesale or wallet amount
});
test("paid child order stagnation is detected with no supplier mutations",()=>{
 assert.equal(multiPostHealthSignal({stale:0,unresolved:0,queued:0}).ok,true);
 assert.equal(multiPostHealthSignal({stale:1,unresolved:0,queued:0}).code,"MULTIPOST_STATUS_STALE");
 assert.equal(multiPostHealthSignal({stale:0,unresolved:1,queued:0}).code,"MULTIPOST_REQUIRES_RECONCILIATION");
 assert.equal(multiPostHealthSignal({stale:0,unresolved:0,queued:1}).code,"MULTIPOST_DISPATCH_DELAYED");
 assert.equal(multiPostHealthSignal({stale:"bad",unresolved:0,queued:0}).ok,false);
});
test("email outbox and regular order probes never claim healthy on invalid readings",()=>{
 assert.equal(deliveryNotificationSignal({customer:0,guardian:0}).ok,true);
 assert.equal(deliveryNotificationSignal({customer:1,guardian:0}).code,"EMAIL_OUTBOX_BACKLOG");
 assert.equal(deliveryNotificationSignal({customer:0,guardian:1}).code,"EMAIL_OUTBOX_BACKLOG");
 assert.equal(regularOrderHealthSignal({stale:0}).ok,true);
 assert.equal(regularOrderHealthSignal({stale:2}).code,"ORDER_STATUS_STALE");
 assert.equal(regularOrderHealthSignal({stale:"not available"}).ok,false);
});
test("Guardian performs read-only Boostero checks and no legacy supplier calls",async()=>{
 const {readFileSync}=await import("node:fs");
 const src=readFileSync(new URL("../lib/guardianRuntime.mjs",import.meta.url),"utf8");
 assert.match(src,/boosteroProduction\("balance"\)/);
 assert.doesNotMatch(src,/SMMGLOB_API_KEY|smmglob\.com/);
 assert.doesNotMatch(src,/boosteroProduction\("add"\)/);
});
