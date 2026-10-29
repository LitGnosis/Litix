import test from "node:test";
import assert from "node:assert/strict";
import {boosteroRetailCandidate, BOOSTERO_RETAIL_MULTIPLIER} from "../lib/boosteroRetail25.mjs";

test("2.5 multiplier and minimum $5 per 1,000",()=>{
  assert.equal(BOOSTERO_RETAIL_MULTIPLIER,2.5);
  assert.equal(boosteroRetailCandidate(2).retailCents,500);
  assert.equal(boosteroRetailCandidate(20).retailCents,5000);
  assert.equal(boosteroRetailCandidate(3).retailCents,750);
});
test("conflicts are quarantined for manual review, not silently accepted",()=>{
  assert.equal(boosteroRetailCandidate(3).reviewReason,"existing_markup_floor_conflict");
  assert.equal(boosteroRetailCandidate(2.5,{maxPer1000Cents:600}).reviewReason,"approved_price_ceiling_conflict");
  assert.equal(boosteroRetailCandidate(20).reviewReason,null);
});
test("reject invalid prices",()=>{
  for(const x of [0,-1,NaN,Infinity,"not_a_number"])assert.equal(boosteroRetailCandidate(x).retailCents,null);
});
