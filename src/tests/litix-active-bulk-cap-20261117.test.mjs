import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {curatedRetailQuote,curatedVolumeDiscountPercent,curatedPreviewCents} from "../lib/curatedVolumePricing.mjs";
import {curatedPublicProduct} from "../lib/curatedCatalog.mjs";
import {quoteCentsForQuantity,checkoutQuantityEligible} from "../lib/litixCheckoutDisplay.mjs";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("volume discounts apply to ALL custom amounts after verified thresholds",()=>{
 assert.deepEqual([999,1000,2499,2500,3000,4999,5000,10000,50000].map(curatedVolumeDiscountPercent),
  [0,0,0,8,8,8,15,15,15]);
 const quote=q=>curatedRetailQuote({quantity:q,retailPer1000Cents:1102,
  pricingRule:"ceil",amountCents:Math.ceil(1102*q/1000),costUSD:6.88*q/1000});
 assert.equal(quote(1000).amountCents,1102);
 assert.equal(quote(2500).amountCents,2535);
 assert.equal(quote(3000).amountCents,3042);
 assert.equal(quote(5000).amountCents,4684);
 assert.equal(quote(10000).amountCents,9367);
 assert.equal(quote(10000).volumeDiscountPercent,15);
 assert.equal(curatedPreviewCents(11.02,3000),3042);
});

test("35 percent minimum markup remains enforced on every custom volume quote",()=>{
 const base=q=>({quantity:q,retailPer1000Cents:1102,pricingRule:"ceil",
  amountCents:Math.ceil(1102*q/1000),costUSD:7.8*q/1000});
 for(const qty of [2500,3000,5000,10000]){
  const q=curatedRetailQuote(base(qty));
  assert.ok(q.amountCents>=Math.ceil(q.costUSD*135-1e-8),String(qty));
  assert.equal(q.volumeDiscountPercent,0);
 }
});

test("public packages mirror exact supplier limits, not an arbitrary 5K cap",()=>{
 const base={service:991111,name:"Instagram USA Followers [ High Quality | 10K/Day ]",
  category:"Instagram - Followers",type:"Default",rate:"2.00",min:"100",max:"50000",refill:false};
 const selected=curatedPublicProduct([base],"Instagram","followers","standard");
 assert.ok(selected);
 assert.equal(selected.max,50000);
 assert.ok(selected.quantityCards.some(x=>x.quantity===50000&&x.available===true));
 assert.ok(selected.quantityCards.some(x=>x.quantity===5000&&x.available===true));
 assert.equal(selected.quantityCards.length,7);
 assert.ok(!JSON.stringify(selected).includes("991111"),"Supplier ID must stay private");
 const smaller=curatedPublicProduct([{...base,max:"5000"}],"Instagram","followers","standard");
 assert.equal(smaller?.max,5000);
 assert.equal(smaller?.quantityCards.length,6);
 assert.equal(quoteCentsForQuantity(smaller,10000),null);
});

test("custom price is unavailable until server verifies exact quantity",()=>{
 const item={id:"curated_instagram_followers_standard",min:100,max:50000,
  unitStep:1,per1000:11.02,pricingRule:"curated",
  quantityCards:[{quantity:1000,totalCents:1102,available:true}]};
 assert.equal(quoteCentsForQuantity(item,3000),null);
 assert.equal(checkoutQuantityEligible(item,3000),false);
 const verified={...item,quantityQuote:{quantity:3000,totalCents:3042,volumeDiscountPercent:8}};
 assert.equal(quoteCentsForQuantity(verified,3000),3042);
 assert.equal(checkoutQuantityEligible(verified,3000),true);
 assert.equal(quoteCentsForQuantity(verified,3001),null);
});

test("customer UI says Active, exposes live max, and never charges during quote request",async()=>{
 const [ui,home,api,readiness,order]=await Promise.all([
  source("../components/CuratedFastCheckout.jsx"),source("../app/page.jsx"),
  source("../app/api/catalog/curated/quote/route.js"),
  source("../app/api/checkout/readiness/route.js"),
  source("../lib/boosteroOrderHandler.mjs")
 ]);
 assert.doesNotMatch(ui,/Real \/ Active|Active \/ Real-Look/);
 assert.match(ui,/>Active <small>Active-account listing/);
 assert.match(ui,/MAX AVAILABLE/);
 assert.match(ui,/formatCuratedUnitRange\(current.min,current.max\)/);
 assert.match(ui,/href=\{"\/services\?platform="/);
 assert.match(ui,/fetch\("\/api\/catalog\/curated\/quote\?"/);
 assert.match(home,/customCuratedQuotePending\?"Verifying custom price…"/);
 assert.match(api,/export async function GET/);
 assert.match(api,/curatedRetailQuote\(boosteroQuote/);
 assert.match(api,/chargeAttempted:false/);
 assert.doesNotMatch(api,/transact\.php|handleBoosteroOrder|paymentToken|fetch\("https:\/\/paykings/);
 assert.match(readiness,/curatedRetailQuote\(boosteroQuote/);
 assert.match(order,/if\(curatedPricing&&!multiple\)/);
});
