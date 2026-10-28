import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {minimumPurchaseQuantity,servicePurchaseMinimum,proposeGeneralRetail,proposeServiceRetail,calculateOrderCents,validateCheckoutQuote,priceCatalog} from "../lib/pricing.mjs";

test("global $5 retail-per-1000 floor across non-special platforms",()=>{
 for(const p of ["Instagram Likes","TikTok Likes","Facebook Shares","YouTube Views","Spotify Plays","Other Comments"]){
  const d=proposeGeneralRetail(0.02,0.58);
  assert.equal(d.retailUsd,5);
  const catalog=priceCatalog([{service:33613,name:p,category:p,rate:0.02,min:10,max:10000,type:"Default"}]);
  assert.equal(catalog.items.length,1);
  assert.ok(catalog.items[0].pricedRetail>=5);
 }
});
test("retail NEVER decreases even when a supplier wholesale rate exceeds $20",()=>{
 assert.equal(proposeGeneralRetail(20,90).retailUsd,90);
 assert.equal(proposeGeneralRetail(20,10).retailUsd,40);
 assert.equal(proposeGeneralRetail(0.01,9).retailUsd,9);
 assert.equal(proposeGeneralRetail(2,15).retailUsd,15);
 assert.equal(proposeGeneralRetail(2,1).retailUsd,10);
});
test("minimum order uses exact per-1000 pricing, supplier minimum, maximum and quantity step",()=>{
 assert.equal(minimumPurchaseQuantity({min:10,max:5000},5),1000);
 assert.deepEqual(servicePurchaseMinimum({min:10,max:5000},5),{quantity:1000,amountCents:500});
 assert.equal(minimumPurchaseQuantity({min:100,max:5000},6.99),716);
 assert.equal(minimumPurchaseQuantity({min:100,max:5000,step:50},6.99),750);
 assert.equal(minimumPurchaseQuantity({min:800,max:5000,step:100},5),1000);
 assert.equal(minimumPurchaseQuantity({min:1,max:999},5),null);
 assert.equal(minimumPurchaseQuantity({min:100,max:100000,step:0},5),null);
});
test("server rejects a $1 line while preserving wholesale markup requirements",()=>{
 assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:0.01,customerSubtotalCents:100,displayedPer1000:5,quantity:200}).allowed,false);
 assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:0.05,customerSubtotalCents:500,displayedPer1000:5,quantity:1000}).allowed,true);
 assert.equal(validateCheckoutQuote({actualSupplierWholesaleUsd:0.1,customerSubtotalCents:500,displayedPer1000:0.58,quantity:1000}).allowed,false);
 assert.equal(calculateOrderCents(100,5),50);
});
test("bundle prices, normal payment gateway and customer order tables stay untouched",()=>{
 const api=readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");
 const bundle=readFileSync(new URL("../lib/growthBundles.mjs",import.meta.url),"utf8");
 assert.match(api,/payment_token:token/);
 assert.match(api,/actualSupplierWholesaleUsd/);
 assert.match(api,/minimumPurchaseQuantity/);
 assert.match(api,/displayedPer1000:retailPer1000\(service\)/);
 assert.match(page,/startingAmountCents/);
 assert.match(page,/Minimum \$5 per service/);
 assert.match(bundle,/5382/);
});
