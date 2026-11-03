import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {componentKeys} from "../lib/guardianCore.mjs";
import {GUARDIAN_COHORTS,CRITICAL_GUARDIAN_CHECKS,guardianCohort} from "../app/api/guardian/cron/route.js";

const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("every Guardian diagnostic is scheduled exactly once per 15-minute rotation",()=>{
 assert.equal(GUARDIAN_COHORTS.length,3);
 const flattened=GUARDIAN_COHORTS.flat();
 assert.equal(new Set(flattened).size,componentKeys.length-CRITICAL_GUARDIAN_CHECKS.length);
 assert.deepEqual([...CRITICAL_GUARDIAN_CHECKS,...flattened].sort(),[...componentKeys].sort());
 assert.deepEqual(CRITICAL_GUARDIAN_CHECKS,["website","paykings_readiness","database"]);
 assert.deepEqual([0,5,10,15,20,25].map(m=>guardianCohort(new Date("2026-11-02T12:"+String(m).padStart(2,"0")+":00Z"))),[0,1,2,0,1,2]);
});
test("Guardian does not perform duplicate supplier order status polling",()=>{
 const guardian=file("app/api/guardian/cron/route.js");
 assert.doesNotMatch(guardian,/syncBoosteroMultiStatuses|resumeBoosteroMultiQueue|dispatchBoosteroPost/);
 assert.match(guardian,/selectedComponents:\[\.\.\.CRITICAL_GUARDIAN_CHECKS,\.\.\.GUARDIAN_COHORTS\[cohort\]\]/);
 assert.match(file("lib/guardianRuntime.mjs"),/selectedComponents=null/);
 assert.match(file("lib/guardianRuntime.mjs"),/order by created_at limit 3 for update skip locked/);
});
test("each supplier cron limits work and retains paid-only once-claimed submission",()=>{
 const primary=file("app/api/internal/boostero/cron/route.js");
 const multi=file("app/api/internal/boostero/multi-cron/route.js");
 assert.match(primary,/syncBoosteroStatuses\(\{limit:3\}\)/);
 assert.match(primary,/deliverLitixCustomerUpdates\(\{limit:3\}\)/);
 assert.doesNotMatch(primary,/resumeBoosteroMultiQueue|syncBoosteroMultiStatuses/);
 assert.match(multi,/syncBoosteroMultiStatuses\(\{sql,limit:6\}\)/);
 assert.match(multi,/dispatchBoosteroPost\(item.parent_order_id,Number\(item.ordinal\),\{sql\}\)/);
 assert.match(multi,/o.payment_state='paid'/);
 assert.match(multi,/p.attempt_id is null/);
 assert.match(multi,/LITIX_MULTIPOST_AUTO_FULFILL_ENABLED/);
 const config=JSON.parse(file("vercel.json"));
 const cron=config.crons.find(x=>x.path==="/api/internal/boostero/multi-cron");
 assert.ok(cron);
 assert.equal(cron.schedule.split(" ")[0].split(",").length,12);
});
test("prepaid AutoLikes schema is RLS protected with unique idempotent sale and claim",()=>{
 const migration=file("db/migrations/20261101-autolikes-prepaid-single-pay.sql");
 assert.match(migration,/idempotency_key uuid NOT NULL UNIQUE/);
 assert.match(migration,/payment_transaction_id text UNIQUE/);
 assert.match(migration,/claim_token uuid UNIQUE/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 const route=file("app/api/autolikes/prepaid/checkout/route.js");
 assert.match(route,/select id from public.litix_autolikes_prepaid_orders where false/);
 assert.match(route,/idempotency_key/);
 assert.match(route,/payment_status='PAID'/);
 assert.doesNotMatch(route,/recurring:"add_subscription"/);
});
