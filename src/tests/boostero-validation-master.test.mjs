import test from "node:test";
import assert from "node:assert/strict";
import {checkBoosteroService,validateBoosteroBatch} from "../lib/boosteroServiceValidation.mjs";
import {normalizeBoosteroService} from "../lib/boosteroGlobalCatalog.mjs";
import {boosteroRetailCandidate} from "../lib/boosteroRetail25.mjs";
const fixture=(id,extra={})=>({service:String(id),name:"Instagram Likes",
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

test("social follower price ceiling requires review, not silent activation",()=>{
 const s=checkBoosteroService(fixture(555,{name:"Instagram Followers",rate:"20.00"}),{approvedCheckout:true});
 assert.equal(s.state,"PENDING_REVIEW");
 assert.equal(s.reason,"existing_social_price_ceiling_conflict");
});
test("no unsupported platform is authorized merely because it is a Default service",()=>{
 const s=checkBoosteroService(fixture(556,{name:"YouTube Views",category:"YouTube"}),{approvedCheckout:true});
 assert.equal(s.state,"VERIFIED");assert.equal(s.reason,"checkout_adapter_not_implemented");
});

test("Boostero wholesale rate is preserved as a decimal string for exact retail cents",()=>{
 const row=normalizeBoosteroService(fixture(777,{rate:"20.000001"}));
 assert.equal(row.wholesaleRateText,"20.000001");
 assert.equal(boosteroRetailCandidate(row.wholesaleRateText).retailCents,5001);
 const invalid=normalizeBoosteroService(fixture(778,{rate:"0.0000001"}));
 assert.equal(invalid,null);
});
