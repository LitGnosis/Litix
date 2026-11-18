import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {boosteroCronPhase,BOOSTERO_CRON_PHASE_LABELS} from "../lib/litixOperationalSchedule.mjs";

const source=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
test("supplier phases alternate every five minutes and cannot drift",()=>{
 assert.deepEqual(BOOSTERO_CRON_PHASE_LABELS,[
  "regular_delivery","multi_post_delivery","paid_multi_post_continuation"
 ]);
 const start=Date.parse("2026-11-02T19:00:00Z");
 assert.deepEqual([0,1,2,3,4,5].map(i=>boosteroCronPhase(start+i*300000)),[0,1,2,0,1,2]);
 assert.throws(()=>boosteroCronPhase(NaN));
});
test("retired Guardian cron cannot run; Boostero status cron is independent",()=>{
 const schedule=JSON.parse(source("vercel.json")).crons;
 assert.equal(schedule.some(x=>x.path==="/api/guardian/cron"),false);
 assert.match(source("app/api/internal/boostero/cron/route.js"),/syncBoosteroStatuses/);
});
test("private supplier cron is bounded, authenticated and cannot blindly retry an accepted order",()=>{
 const route=source("app/api/internal/boostero/cron/route.js");
 const vercel=JSON.parse(source("vercel.json"));
 assert.equal(vercel.crons.find(c=>c.path==="/api/internal/boostero/cron")?.schedule,"*/5 * * * *");
 assert.match(route,/timingSafeEqual/);
 assert.match(route,/process\.env\.VERCEL_ENV!=="production"/);
 assert.match(route,/syncBoosteroStatuses\(\{limit:3\}\)/);
 assert.match(route,/syncBoosteroMultiStatuses\(\{limit:5\}\)/);
 assert.match(route,/resumeBoosteroMultiQueue\(\{limitParents:1\}\)/);
 assert.match(route,/deliverLitixCustomerUpdates\(\{limit:2\}\)/);
 assert.doesNotMatch(route,/boosteroProduction\("add"\)|dispatchBoostero\(/);
});
test("retired prepaid checkout cannot charge and preserves historical order records",()=>{
 const route=source("app/api/autolikes/prepaid/checkout/route.js");
 assert.match(route,/chargeAttempted: false/);
 assert.match(route,/checkoutEnabled: false/);
 assert.match(route,/status: 409/);
 assert.doesNotMatch(route,/paymentToken|transact|boosteroProduction/);
 const migration=source("db/migrations/20261101-autolikes-prepaid-single-pay.sql");
 assert.match(migration,/ALTER TABLE public\\.litix_autolikes_prepaid_orders ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/supplier_order_id text UNIQUE/);
});
