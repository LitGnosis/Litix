import test from "node:test";
import assert from "node:assert/strict";
import {checkBoosteroService,validateBoosteroBatch} from "../lib/boosteroServiceValidation.mjs";
const fixture=(id,extra={})=>({service:String(id),name:"Instagram Followers",
 category:"Instagram",type:"Default",rate:"20.00",min:"100",max:"100",...extra});
test("fixed-quantity services are valid; no hardcoded service IDs",()=>{
 for(const id of [5461,10001,888888,1]){
  const x=checkBoosteroService(fixture(id),{approvedCheckout:true});
  assert.equal(x.state,"PURCHASABLE");
  assert.equal(x.retailCents,5000);
 }
});
test("one malformed service cannot insert an invalid ID",()=>{
 const batch=validateBoosteroBatch([fixture(5461),fixture(5461),fixture(32,{service:""}),fixture(33,{rate:"NaN"}),fixture(99)]);
 assert.equal(batch.received,5);
 assert.equal(batch.valid.length,2);
 assert.equal(batch.excluded.length,3);
 assert.ok(batch.excluded.some(x=>x.reason==="duplicate_service_id"));
 assert.ok(batch.excluded.some(x=>x.reason==="missing_or_invalid_service_id"));
});
test("unrecognized order type never becomes purchasable",()=>{
 assert.equal(checkBoosteroService(fixture(43,{type:"Unverified New Type"}),{approvedCheckout:true}).state,"UNSUPPORTED_TYPE");
});
test("2.5 markup cannot circumvent previously approved floor",()=>{
 const s=checkBoosteroService(fixture(44,{rate:"2.00"}),{approvedCheckout:true});
 assert.equal(s.state,"PENDING_REVIEW");
 assert.equal(s.reason,"existing_markup_floor_conflict");
});
test("package service is imported but needs verified package contract",()=>{
 const s=checkBoosteroService(fixture(45,{type:"Package",rate:"20"}),{approvedCheckout:true});
 assert.equal(s.state,"PENDING_REVIEW");
});
test("without approval a verified eligible service stays non-purchasable",()=>{
 assert.equal(checkBoosteroService(fixture(46)).state,"VERIFIED");
});
