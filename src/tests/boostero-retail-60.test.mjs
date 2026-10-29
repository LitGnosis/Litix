import test from "node:test";
import assert from "node:assert/strict";
import {NEW_SERVICE_MARKUP,proposeBoostero60RetailRate,quoteBoostero60Order,publicBoosteroRetailQuote} from "../lib/boosteroRetail60.mjs";
test("new standard service receives exactly 60 percent markup unless floor higher",()=>{
 assert.equal(NEW_SERVICE_MARKUP,1.6);
 assert.equal(proposeBoostero60RetailRate(10).retailPer1000Cents,1600);
 assert.equal(proposeBoostero60RetailRate(3).retailPer1000Cents,500);
 assert.equal(proposeBoostero60RetailRate(20).retailPer1000Cents,3200);
 assert.equal(proposeBoostero60RetailRate(0).valid,false);
});
test("protects the four previously approved retail prices",()=>{
 const p=proposeBoostero60RetailRate(3,{existingApprovedRetailCents:1500});
 assert.equal(p.preserved,true);assert.equal(p.retailPer1000Cents,1500);
 assert.equal(p.eligibleForAutomaticActivation,false);
});
test("server total varies with quantity and never permits under $5 checkout",()=>{
 const tooSmall=quoteBoostero60Order({wholesaleUsdPer1000:10,quantity:100,min:50,max:10000});
 assert.equal(tooSmall.valid,false);
 assert.equal(tooSmall.reason,"below_five_dollar_minimum");
 const first=quoteBoostero60Order({wholesaleUsdPer1000:10,quantity:500,min:50,max:10000});
 const second=quoteBoostero60Order({wholesaleUsdPer1000:10,quantity:1000,min:50,max:10000});
 assert.equal(first.customerAmountCents,800);assert.equal(second.customerAmountCents,1600);
 assert.equal(publicBoosteroRetailQuote(second).checkoutAuthorized,false);
 assert.equal(Object.hasOwn(publicBoosteroRetailQuote(second),"supplierCostCents"),false);
});
test("dripfeed charges by quantity times runs",()=>{
 const quote=quoteBoostero60Order({wholesaleUsdPer1000:2,quantity:100,runs:10,min:50,max:10000});
 assert.equal(quote.valid,true);assert.equal(quote.totalUnits,1000);assert.equal(quote.customerAmountCents,500);
});
test("unknown package and ongoing subscription pricing require distinct approved quote",()=>{
 for(const type of ["Package","Subscriptions","Custom Comments"]){
  assert.equal(quoteBoostero60Order({orderType:type,wholesaleUsdPer1000:5,quantity:1000,min:100,max:2000}).valid,false);
 }
});
test("rejects invalid quantity bounds and money overflow",()=>{
 assert.equal(quoteBoostero60Order({wholesaleUsdPer1000:2,quantity:1,min:100,max:1000}).valid,false);
 assert.equal(quoteBoostero60Order({wholesaleUsdPer1000:-1,quantity:1000,min:10,max:10000}).valid,false);
 assert.equal(quoteBoostero60Order({wholesaleUsdPer1000:100000000,quantity:1000,min:10,max:10000}).valid,false);
});
