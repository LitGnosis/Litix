import test from "node:test";
import assert from "node:assert/strict";
import {mapOwnerTriage,loadGuardianOwnerTriage} from "../lib/guardianTriage.mjs";
const id="ltx2_12345678-1234-4234-8234-123456789abc";
test("owner queue shows actionable supplier partials, never customer PII",()=>{
 const v=mapOwnerTriage("partial",[{order_id:id,ordinal:3,supplier_order_id:"12977369",state:"MANUAL_REVIEW",email:"private@example.com",destination:"https://tiktok.com/private"}]);
 assert.equal(v[0].supplierOrderId,"12977369");
 assert.equal(v[0].postIndex,3);
 assert.equal(v[0].code,"SUPPLIER_NEEDS_RECONCILIATION");
 assert.doesNotMatch(JSON.stringify(v),/private@example.com|tiktok.com/);
});
test("unknown payment and stale supplier snapshots guide safe reconciliation, not repeat purchases",()=>{
 const stale=mapOwnerTriage("stale",[{order_id:id,supplier_order_id:"12977366",ordinal:1}]);
 assert.match(stale[0].action,/never resubmit/);
 const uncertain=mapOwnerTriage("payment",[{order_id:id,payment_state:"review"}]);
 assert.match(uncertain[0].action,/before charging/);
 assert.deepEqual(mapOwnerTriage("partial",[{order_id:"bad",email:"hidden"}]),[]);
});
test("all five diagnostic queries are read-only and partial failure is visible",async()=>{
 const executed=[];
 const db={query:async(sql)=>{
  executed.push(sql);
  assert.match(sql.trim(),/^select\b/i);
  assert.doesNotMatch(sql,/update |insert |delete |drop |alter |truncate /i);
  if(sql.includes("litix_growth_bundle_orders"))throw Error("mock temporary db outage");
  if(sql.includes("m.state in ('MANUAL_REVIEW'"))return [{order_id:id,ordinal:3,supplier_order_id:"12977369"}];
  return [];
 }};
 const r=await loadGuardianOwnerTriage(db);
 assert.equal(executed.length,5);
 assert.equal(r.unavailableChecks,1);
 assert.equal(r.items.length,1);
 assert.equal(r.readOnly,true);
});
