import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {curatedPsychologicalCents,curatedRetailQuote,curatedPreviewCents} from "../lib/curatedVolumePricing.mjs";
import {normalizeProfile,publicProfileFromRows} from "../lib/postPicker.mjs";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("retail tiers are curated but never lower than live margin floors",()=>{
 assert.equal(curatedPsychologicalCents(110,100),129);
 assert.equal(curatedPsychologicalCents(276,100),299);
 assert.equal(curatedPsychologicalCents(551,100),599);
 assert.equal(curatedPsychologicalCents(1102,900),1099);
 assert.equal(curatedPsychologicalCents(2535,2000),2499);
 assert.equal(curatedPreviewCents(11.02,1000),1099);
 const q=curatedRetailQuote({quantity:1000,retailPer1000Cents:1102,costUSD:6.88,
  pricingRule:"ceil",amountCents:1102,kind:"followers",platform:"Instagram"});
 assert.equal(q.amountCents,1099);
 assert.throws(()=>curatedRetailQuote({quantity:1000,retailPer1000Cents:1102,
  costUSD:9,pricingRule:"ceil",amountCents:1102,kind:"followers",platform:"Instagram"}));
 const guarded=curatedRetailQuote({quantity:5000,retailPer1000Cents:1102,
  costUSD:39,pricingRule:"ceil",amountCents:5510,kind:"followers",platform:"Instagram"});
 assert.ok(guarded.amountCents>=Math.ceil(39*135));
 assert.equal(guarded.volumeDiscountPercent,0);
});

test("profile metadata never accepts a different account or untrusted avatar",()=>{
 const ig=normalizeProfile("instagram","https://instagram.com/Creator.Name/");
 assert.equal(ig,"creator.name");
 assert.equal(normalizeProfile("instagram","https://evil.com/creator"),null);
 const correct=publicProfileFromRows("instagram","creator.name",[{
  owner:{username:"CREATOR.NAME",profilePicUrl:"https://cdn.example.net/a.jpg",followersCount:25000,likesCount:91}
 }]);
 assert.equal(correct.avatarUrl,"https://cdn.example.net/a.jpg");
 assert.equal(correct.followersCount,25000);
 const unknown=publicProfileFromRows("instagram","creator.name",[{
  owner:{username:"other",profilePicUrl:"https://cdn.example.net/a.jpg",followersCount:9999999}
 }]);
 assert.equal(unknown.followersCount,null);
});

test("only genuine provider refills are offered; wallet buttons do not claim live support",async()=>{
 const [tracker,refill,selector,checkout,mobile,hero,activity,publicApi]=await Promise.all([
  source("../app/api/internal/boostero/track/route.js"),
  source("../app/api/track/refill/route.js"),
  source("../components/CuratedFastCheckout.jsx"),
  source("../components/PremiumInlineCheckout.jsx"),
  source("../components/LitixMobileCheckoutBar.jsx"),
  source("../components/LitixQuickShop.jsx"),
  source("../components/LitixVerifiedActivityToast.jsx"),
  source("../app/api/profile-preview/route.js")
 ]);
 assert.match(tracker,/hashBoostero\(token\)/);
 assert.match(tracker,/boosteroProduction\("status"/);
 assert.match(refill,/hashBoostero\(token\)/);
 assert.match(refill,/boosteroProduction\("refill"/);
 assert.match(refill,/litix_boostero_attempts/);
 assert.match(refill,/apiRefill\(service\)/);
 assert.match(checkout,/disabled=\{!enabled\}/);
 assert.match(checkout,/walletHandlers\[wallet\]/);
 assert.match(mobile,/scrollIntoView/);
 assert.doesNotMatch(selector,/Checking live supplier limits/);
 assert.doesNotMatch(selector,/lifetime drop protection|30-day refill protection/i);
 assert.match(hero,/Social Growth for Creators/);
 assert.doesNotMatch(hero,/4\.9\/5|12,400\+|Someone in Dallas/i);
 assert.match(activity,/verifiedDispatchedOrders24h/);
 assert.match(publicApi,/normalizeProfile/);
 assert.match(await source("../components/LitixProfilePreview.jsx"),/Search public profile for posts/);
 assert.match(await source("../app/page.jsx"),/onChoosePost=\{postUrl=>/);
});
