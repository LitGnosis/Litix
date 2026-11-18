import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {initialCuratedOffer,curatedPresetQuantity,formatCuratedUnitRange} from "../lib/litixCuratedFirstPaint.mjs";
import {checkoutTargetPlaceholder} from "../lib/litixOrderTarget.mjs";
import {verifiedVolumeSavings,curatedQuantityBadge} from "../lib/litixCuratedSavings.mjs";
const file=relative=>readFile(new URL(relative,import.meta.url),"utf8");

test("featured 1,000 follower package is preselected in initial HTML, without a payment bypass",async()=>{
 const [home,selector,card]=await Promise.all([
  file("../app/page.jsx"),file("../components/CuratedFastCheckout.jsx"),
  file("../components/PremiumInlineCheckout.jsx")
 ]);
 const offer=initialCuratedOffer();
 assert.equal(offer.id,"curated_instagram_followers_standard");
 assert.equal(offer.per1000,11.02);
 assert.equal(offer.preview,true);
 assert.equal(offer.purchasable,false);
 assert.equal(curatedPresetQuantity(offer),1000);
 assert.equal(offer.quantityCards.find(c=>c.quantity===1000).totalCents,1099);
 assert.match(home,/useState\(CURATED_HOME_ENABLED\?firstPaintOffer:INITIAL_FAST_SERVICE\)/);
 assert.match(home,/useState\(CURATED_HOME_ENABLED\?curatedPresetQuantity\(firstPaintOffer\):INITIAL_FAST_QUANTITY\)/);
 assert.match(selector,/aria-pressed=\{quantity===card.quantity\}/);
 assert.match(card,/disabled=\{!canPay \|\| !cardReady \|\| busy\}/);
 assert.match(home,/checkoutAuthorized&&detailsReady&&cardReady/);
 assert.doesNotMatch(home,/Preparing the focused checkout/);
 assert.doesNotMatch(home,/Choose a package in Step 03\./);
 assert.doesNotMatch(home,/Choose a package to continue/);
 assert.doesNotMatch(home,/The total appears after a package is selected/);
});
test("unverified VIP pill is not displayed; prices use truthful phase-based language",async()=>{
 const [selector,preview]=await Promise.all([
  file("../components/CuratedFastCheckout.jsx"),
  file("../lib/curatedStaticPreview.mjs")
 ]);
 assert.match(selector,/live\(platform,kind,"vip"\)&&<button/);
 assert.doesNotMatch(selector,/Not currently verified/);
 assert.doesNotMatch(selector,/Price estimates from a saved catalog/);
 assert.doesNotMatch(selector,/Previously listed · Check live price/);
 assert.doesNotMatch(selector,/Litix pricing · Final USD total verified before payment/);
 assert.doesNotMatch(preview,/Previously listed · Check live price before checkout/);
 assert.equal(formatCuratedUnitRange(90,5000),"90–5,000 units");
 assert.match(selector,/formatCuratedUnitRange\(current.min,current.max\)/);
});
test("each public link field uses current platform and service placeholders",async()=>{
 const cases=[
  ["Instagram","followers","e.g. @username or https://instagram.com"],
  ["Instagram","likes","e.g. https://instagram.com... or /reel/..."],
  ["Instagram","views","e.g. https://instagram.com... or /reel/..."],
  ["Instagram","comments","e.g. https://instagram.com... or /reel/..."],
  ["TikTok","followers","e.g. @username or https://tiktok.com"],
  ["TikTok","likes","e.g. https://tiktok.com..."],
  ["TikTok","views","e.g. https://tiktok.com..."],
  ["YouTube","subscribers","e.g. @channel or https://youtube.com/@channel"],
  ["Facebook","followers","e.g. @page or https://facebook.com/page"],
  ["X","likes","e.g. https://x.com/creator/status/123456789012"]
 ];
 for(const [platform,kind,expected] of cases){
  assert.equal(checkoutTargetPlaceholder({platform,kind}),expected);
 }
 const home=await file("../app/page.jsx");
 assert.match(home,/placeholder=\{checkoutTargetPlaceholder\(selected\)\}/);
 assert.doesNotMatch(home,/key=\{String\(selected\?\.platform/);
});
test("unverified volume discount labels never display fake percentage savings",()=>{
 const cards=[100,250,500,1000,2500,5000].map(q=>({
  quantity:q,totalCents:Math.ceil(11.02*q/10),available:true
 }));
 for(const amount of [1000,2500,5000]){
  assert.equal(verifiedVolumeSavings(cards,amount),null);
  assert.doesNotMatch(curatedQuantityBadge(cards,amount,{live:true}),/Save \d+%/);
 }
 assert.equal(curatedQuantityBadge(cards,1000,{live:true}),"FEATURED");
 assert.equal(curatedQuantityBadge(cards,2500,{live:true}),"MORE REACH");
 assert.equal(curatedQuantityBadge(cards,5000,{live:true}),"MAX REACH");
});
