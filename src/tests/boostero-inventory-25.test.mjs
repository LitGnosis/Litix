import test from "node:test";
import assert from "node:assert/strict";
import {importBoosteroInventory} from "../lib/boosteroInventorySync.mjs";
const fixture=(count=110)=>Array.from({length:count},(_,i)=>({
 service:String(100000+i),name:"Instagram Followers Test "+i,
 category:"Instagram",type:i===3?"Package":"Default",
 rate:i===3?"12.00":"3.00",min:100,max:10000,
 refill:false,cancel:false,dripfeed:false
}));
test("incomplete supplier response aborts before inventory writes",async()=>{
 let calls=0;
 const db={query:async()=>{calls++;return [];}};
 await assert.rejects(importBoosteroInventory(db,fixture(7)),/inventory_supplier_snapshot_incomplete/);
 assert.equal(calls,0);
});
test("atomic inventory candidate pricing has review flags and no public activation",async()=>{
 const calls=[];
 const db={query:async(query,args)=>{calls.push({query,args});
   return calls.length===1?[{n:0,last_sync:null}]:[{imported:110,marked_unavailable:0,audit_records:1}];
 }};
 const result=await importBoosteroInventory(db,fixture(110));
 assert.equal(result.imported,110);
 assert.equal(result.pricingMultiplier,2.5);
 assert.equal(result.publicNewServicesEnabled,0);
 const payload=JSON.parse(calls[1].args[0]);
 assert.equal(payload[0].retail,750);
 assert.equal(payload[0].review,"existing_markup_floor_conflict");
 assert.equal(payload[3].retail,null);
 assert.equal(payload[3].review,"special_service_price_contract_unverified");
 assert.match(calls[1].query,/pricing_review_reason/);
 assert.doesNotMatch(calls[1].query,/litix_v2_orders/);
});
