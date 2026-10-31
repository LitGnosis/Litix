import test from "node:test";
import assert from "node:assert/strict";
import {boosteroBatchIds,normalizeBoosteroStatus,boosteroChildState,boosteroSupplierDelivered} from "../lib/boosteroStatusBatch.mjs";
test("status batches accept at most 100 unique numeric IDs",()=>{
 assert.deepEqual(boosteroBatchIds(["12977366","12977367"]),["12977366","12977367"]);
 assert.equal(boosteroBatchIds(Array.from({length:100},(_,i)=>String(i+1))).length,100);
 for(const bad of [[],["1","1"],["1","abc"],Array.from({length:101},(_,i)=>String(i+1))])
  assert.throws(()=>boosteroBatchIds(bad));
});
test("provider response validation does not accept unexpected status or invalid remains",()=>{
 assert.deepEqual(normalizeBoosteroStatus({status:"In progress",remains:"897"}),{status:"In progress",remains:897});
 assert.equal(normalizeBoosteroStatus({error:"Incorrect order ID"}),null);
 assert.equal(normalizeBoosteroStatus({status:"Completed",remains:"invalid"}),null);
 assert.equal(normalizeBoosteroStatus({status:"made up"}),null);
 assert.equal(boosteroChildState("Partial"),"MANUAL_REVIEW");
 assert.equal(boosteroChildState("Completed"),"COMPLETED");
});
test("delivery progress never converts unknown remaining into delivered=total",()=>{
 assert.equal(boosteroSupplierDelivered(918,897),21);
 assert.equal(boosteroSupplierDelivered(918,null),null);
 assert.equal(boosteroSupplierDelivered(918,919),null);
});
