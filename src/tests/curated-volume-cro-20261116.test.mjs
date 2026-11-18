import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {curatedRetailQuote,curatedPreviewCents} from "../lib/curatedVolumePricing.mjs";
import {verifiedVolumeSavings,curatedQuantityBadge} from "../lib/litixCuratedSavings.mjs";
import {quoteCentsForQuantity} from "../lib/litixCheckoutDisplay.mjs";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");
test("curated cents and discounts agree with payment validator",()=>{
 const quote=q=>curatedRetailQuote({quantity:q,retailPer1000Cents:1102,
  pricingRule:"ceil",amountCents:Math.ceil(1102*q/1000),costUSD:6.88*q/1000});
 assert.deepEqual([100,250,1000,2500,5000].map(q=>quote(q).amountCents),[129,299,1099,2499,4699]);
 const cards=[100,250,500,1000,2500,5000].map(q=>({quantity:q,totalCents:quote(q).amountCents,available:true}));
 assert.equal(verifiedVolumeSavings(cards,2500),9);
 assert.equal(verifiedVolumeSavings(cards,5000),null,"do not claim savings that rounded retail prices cannot prove");
 assert.equal(curatedQuantityBadge(cards,2500,{live:true}),"SAVE 9%");
 assert.equal(curatedQuantityBadge(cards,5000,{live:true}),"MAX REACH");
 const item={id:"curated_instagram_followers_standard",min:100,max:5000,unitStep:1,per1000:11.02,pricingRule:"curated",quantityCards:cards};
 for(const q of [100,250,500,1000,2500,5000])assert.equal(quoteCentsForQuantity(item,q),quote(q).amountCents);
 assert.equal(curatedPreviewCents(11.02,100),129);
});
test("35% minimum markup blocks unsafe volume discounts",()=>{
 const q=curatedRetailQuote({quantity:5000,retailPer1000Cents:1102,pricingRule:"ceil",amountCents:5510,costUSD:39});
 assert.ok(q.amountCents>=5510,"rounding must not undercut protected cost");
 assert.equal(q.volumeDiscountPercent,0);
});
test("upsell and repeated step banners removed; preflight and payment share quote",async()=>{
 const [home,ui,ready,post,api,fulfill]=await Promise.all([
  read("../app/page.jsx"),read("../components/CuratedFastCheckout.jsx"),
  read("../app/api/checkout/readiness/route.js"),read("../lib/boosteroOrderHandler.mjs"),
  read("../app/api/checkout/v1/route.js"),read("../lib/boosteroFulfillment.mjs")]);
 assert.doesNotMatch(home,/Add 30-Day Auto-Likes \(currently unavailable\)/);
 assert.doesNotMatch(home,/className="checkout-steps"/);
 assert.match(ui,/Recommended · Verified package/);
 assert.match(ui,/Essential · Value Rate/);
 assert.match(ready,/curatedRetailQuote\(boosteroQuote/);
 assert.match(post,/if\(curatedPricing&&!multiple\)/);
 assert.match(api,/curatedPricing:!!curated/);
 assert.match(fulfill,/metadata\?\.curatedPricing===true/);
});
