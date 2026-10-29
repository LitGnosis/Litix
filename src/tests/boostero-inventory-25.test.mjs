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

test("release-gated default service IDs auto-publish without hardcoded ID list",async()=>{
 const sqlCalls=[];
 const db={query:async(query,args)=>{
  sqlCalls.push({query,args});
  return sqlCalls.length===1?[{n:0,last_sync:null}]:
   [{imported:110,activated:110,marked_unavailable:0,audit_records:1}];
 }};
 const data=fixture(110).map(x=>({...x,rate:"0.50",type:"Default",name:"Instagram Likes Test"}));
 const response=await importBoosteroInventory(db,data,{autoPublish:true});
 assert.equal(response.publicNewServicesEnabled,110);
 const rows=JSON.parse(sqlCalls[1].args[0]);
 assert.equal(sqlCalls[1].args[5],true);
 assert.ok(rows.every(x=>x.state==="PURCHASABLE"&&x.review===null&&x.retail>=600));
 assert.match(sqlCalls[1].query,/ON CONFLICT \(supplier_service_id\) DO NOTHING/);
 assert.doesNotMatch(sqlCalls[1].query,/update\s+public\.litix_v2_orders/i);
});

test("verified complete snapshot disables missing public IDs without touching historical orders",async()=>{
 const db={query:async(q,args)=>q.includes("select count(*)::integer as n")?
  [{n:0,last_sync:null}]:[{imported:110,activated:0,disabled_public:2,marked_unavailable:2,audit_records:1}]};
 const result=await importBoosteroInventory(db,fixture(110));
 assert.equal(result.disabledPublicServices,2);
 assert.equal(result.markedUnavailable,2);
});
