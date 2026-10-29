import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("the existing PayKings Collect.js checkout cannot be replaced by a guessed charge endpoint",()=>{
 const handler=source("lib/boosteroOrderHandler.mjs");
 const publicCheckout=source("app/api/checkout/v1/route.js");
 assert.match(handler,/paykings\.transactiongateway\.com\/api\/transact\.php/);
 assert.match(handler,/NMI_SECURITY_KEY/);
 assert.match(handler,/idempotencyKey/);
 assert.doesNotMatch(handler,/PAYKINGS_API_URL/);
 assert.match(publicCheckout,/handleBoosteroOrder/);
 assert.match(publicCheckout,/boostero_\\[0-9\\]/);
});

test("supplier requests remain form encoded and require a prior one-way claim",()=>{
 const supplier=source("lib/boosteroReadOnly.mjs");
 const fulfillment=source("lib/boosteroFulfillment.mjs");
 assert.match(supplier,/application\/x-www-form-urlencoded/);
 assert.match(supplier,/options\.claimed!==true/);
 assert.match(supplier,/URLSearchParams/);
 assert.match(fulfillment,/UNKNOWN_OUTCOME/);
 assert.match(fulfillment,/litix_v2_orders/);
 assert.match(fulfillment,/litix_boostero_fulfillment/);
});

test("project deploy configuration retains working recurring jobs",()=>{
 const config=JSON.parse(source("vercel.json"));
 assert.equal(config.framework,"nextjs");
 const crons=new Set(config.crons.map(item=>item.path));
 for(const existing of ["/api/bundles/cron","/api/guardian/cron",
  "/api/internal/boostero/cron"])
  assert.equal(crons.has(existing),true);
 assert.notEqual(config.github?.enabled,false);
});

test("protected owner logs and catalog sync do not accept a body override key",()=>{
 const dashboard=source("app/api/owner/boostero/route.js");
 const sync=source("app/api/internal/boostero/inventory-sync/route.js");
 assert.match(dashboard,/ownerRequest\(req\)/);
 assert.match(sync,/ownerRequest\(req\)/);
 assert.match(sync,/LITIX_BOOSTERO_BACKUP_VERIFIED/);
 assert.match(sync,/LITIX_BOOSTERO_GLOBAL_SYNC_ENABLED/);
 assert.doesNotMatch(dashboard+sync,/sysOverrideKey|SYS_ADMIN_OVERRIDE|adminSecretKey/);
});
