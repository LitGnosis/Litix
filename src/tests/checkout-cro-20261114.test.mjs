import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("Fast Checkout always mounts one gateway CTA within its form",async()=>{
 const page=await source("../app/page.jsx");
 const component=await source("../components/PremiumInlineCheckout.jsx");
 assert.equal((page.match(/<PremiumInlineCheckout\b/g)||[]).length,1);
 assert.ok(page.indexOf("<PremiumInlineCheckout")>page.indexOf('className="litix-pick-first"'));
 assert.ok(page.indexOf("<PremiumInlineCheckout")<page.indexOf("</form>{notice&&"));
 assert.match(component,/type="submit"/);
 assert.match(component,/disabled=\{!canPay \|\| !cardReady \|\| busy\}/);
 assert.match(page,/Continue to Secure Checkout/);
 assert.match(page,/Pay with PayKings/);
 assert.match(component,/premium-pay-spinner/);
 assert.match(component,/showFields &&/);
});

test("All verified payment actions retain hosted fields and live supplier checks",async()=>{
 const page=await source("../app/page.jsx");
 const component=await source("../components/PremiumInlineCheckout.jsx");
 const endpoint=await source("../app/api/checkout/readiness/route.js");
 for(const id of ["ccnumber","ccexp","cvv"])assert.match(component,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(component,/name="(?:cardNumber|cvc|expiry)"/);
 assert.match(page,/verifyQuoteBeforePayment\(\)/);
 assert.match(page,/fetch\("\/api\/checkout\/readiness\?"/);
 assert.match(page,/getCollectJS\(\)\.startPaymentRequest\(\)/);
 assert.match(page,/paymentToken:token/);
 assert.match(endpoint,/verifyBoosteroQuote\(serviceId,quantity\)/);
 assert.match(page,/postAllocations:multiPosts/);
});

test("Selected package has one range and price without duplicate metadata",async()=>{
 const page=await source("../app/page.jsx");
 const selector=await source("../components/LitixCheckoutSelector.jsx");
 assert.doesNotMatch(page,/selected-service-meta/);
 assert.doesNotMatch(page,/Available range:/);
 assert.match(selector,/checkoutDisplay\(current\)\.title/);
 assert.match(selector,/checkoutDisplay\(current\)\.subtitle/);
 assert.match(selector,/Allowed quantity: \{allowedRange\}/);
 assert.match(selector,/\$\{Number\(current\.min\)\.toLocaleString\("en-US"\)\}–\$\{Number\(current\.max\)\.toLocaleString\("en-US"\)\}/);
 assert.match(selector,/\(\$\{specialty\.length\}\)/);
 assert.match(page,/QUANTITY_PRESETS\.map/);
 assert.match(page,/clampCheckoutQuantity/);
});

test("Pricing and footer copy are unified",async()=>{
 const page=await source("../app/page.jsx");
 const selector=await source("../components/LitixCheckoutSelector.jsx");
 const services=await source("../app/services/page.jsx");
 const component=await source("../components/PremiumInlineCheckout.jsx");
 assert.match(page,/Total \(USD\)/);
 assert.doesNotMatch(page,/Estimated USD total|checked before payment|Review your public link, quantity and email to continue/);
 assert.doesNotMatch(selector,/final price and eligibility are checked before payment/);
 const brand="LITIX — Innovation, Ignited.";
 assert.ok(page.includes(brand));
 assert.ok(services.includes("Social Growth for Creators, Brands & Agencies"));
 assert.match(component,/Final price and service availability are verified before payment/);
 assert.equal((component.match(/No social passwords required/g)||[]).length,1);
 assert.equal((page.match(/Analytics Amplified|Metrics that Move|Data Driven Discovery/g)||[]).length,0);
});
