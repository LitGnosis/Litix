import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {CHECKOUT_PLATFORMS,choicesForPlatform,combineCheckoutChoices,
 defaultKindFor,firstPackageFor} from "../lib/litixCheckoutBootstrap.mjs";
import {VERIFIED_CHECKOUT_SEED} from "../lib/litixCheckoutVerifiedSeed.mjs";
import {validateLitixCheckoutTarget} from "../lib/litixOrderTarget.mjs";

const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("static checkout bootstrap contains actual Neon-verified services for all five platforms",()=>{
 assert.ok(VERIFIED_CHECKOUT_SEED.observedAt?.startsWith("2026-"));
 assert.ok(VERIFIED_CHECKOUT_SEED.items.length>=100);
 for(const platform of CHECKOUT_PLATFORMS){
  const choices=choicesForPlatform(platform);
  assert.ok(choices.items.length>0,platform);
  assert.ok(choices.kinds.length>0,platform);
  for(const item of choices.items){
   assert.match(item.id,/^litix_\d{1,12}$/);
   assert.equal(item.platform,platform);
   assert.ok(item.min>0&&item.max>=item.min&&item.per1000>0);
   assert.equal(item.purchasable,true);
   assert.doesNotMatch(item.name,/Boostero|SMMGLOB/i);
  }
 }
 const instagram=choicesForPlatform("Instagram");
 const kind=defaultKindFor(instagram,"followers");
 assert.equal(kind,"followers");
 const item=firstPackageFor(instagram,kind);
 assert.ok(item?.id);
 assert.ok(Math.ceil(item.per1000*item.min/10)>=100);
});

test("API errors never erase the verified static selection",()=>{
 const cached=choicesForPlatform("TikTok");
 const unavailable=combineCheckoutChoices("TikTok",{items:[],catalogStatus:"unavailable"},cached);
 assert.equal(unavailable.items.length,cached.items.length);
 assert.equal(unavailable.liveAvailability,false);
 assert.equal(unavailable.catalogStatus,"static");
 const fake=combineCheckoutChoices("Instagram",{items:[{id:"litix_5555",platform:"TikTok",
   kind:"followers",min:100,max:999,per1000:9,startingAmountCents:100,purchasable:true}]});
 assert.ok(fake.items.every(x=>x.platform==="Instagram"));
});

test("link guidance adapts to followers vs post/video destinations",()=>{
 const follower={platform:"Instagram",kind:"followers"};
 const likes={platform:"Instagram",kind:"likes"};
 assert.equal(validateLitixCheckoutTarget("@creator",follower).ok,true);
 assert.equal(validateLitixCheckoutTarget("https://instagram.com/p/abc123/",follower).ok,false);
 assert.equal(validateLitixCheckoutTarget("https://www.instagram.com/reel/abc123/",likes).ok,true);
 assert.equal(validateLitixCheckoutTarget("https://www.instagram.com/creator/",likes).ok,false);
 assert.equal(validateLitixCheckoutTarget("https://www.tiktok.com/@creator/video/1234567890123456789",
  {platform:"TikTok",kind:"likes"}).ok,true);
 assert.equal(validateLitixCheckoutTarget("https://youtu.be/abcdefghijk",
  {platform:"YouTube",kind:"views"}).ok,true);
 assert.equal(validateLitixCheckoutTarget("https://x.com/creator/status/123456789012",
  {platform:"Twitter (X)",kind:"retweets"}).ok,true);
 assert.equal(validateLitixCheckoutTarget("javascript:alert(1)",likes).ok,false);
});

test("selector never has a disabled initial loading gate and has 4-second background refresh",async()=>{
 const sourceText=await source("../components/LitixCheckoutSelector.jsx");
 assert.match(sourceText,/const INITIAL=choicesForPlatform\("Instagram"\)/);
 assert.match(sourceText,/useState\(INITIAL\)/);
 assert.match(sourceText,/setTimeout\(\(\)=>ctrl\.abort\("catalog_refresh_deadline"\),4000\)/);
 assert.doesNotMatch(sourceText,/Loading verified services…|Loading Litix packages from our verified catalog…/);
 assert.doesNotMatch(sourceText,/disabled=\{loading\|\|/);
 assert.match(sourceText,/aria-pressed=\{platform===choice\.platform&&kind===choice\.kind\}/);
 const api=await source("../app/api/catalog/checkout-choices/route.js");
 assert.match(api,/choicesForPlatform\(platform\)/);
 assert.match(api,/readDurableCatalog\(\)/);
 assert.match(api,/after\(async\(\)=>/);
});

test("checkout protects the customer from a stale quote while keeping valid input actionable",async()=>{
 const page=await source("../app/page.jsx");
 const preflight=await source("../app/api/checkout/readiness/route.js");
 assert.match(page,/checkoutPhase/);
 for(const phase of ["idle","validating","ready","processing","error"])
  assert.ok(page.includes('"'+phase+'"'),phase);
 assert.match(page,/validateLitixCheckoutTarget\(link,selected\)/);
 assert.match(page,/!multiMode&&<label className="litix-early-link"/);
 assert.doesNotMatch(page,/Choose Custom Followers or Custom Likes above to begin/);
 assert.match(page,/Verify secure checkout/);
 assert.match(preflight,/verifyBoosteroQuote/);
 assert.match(preflight,/chargeAttempted:false/);
 assert.match(preflight,/3400/);
 assert.match(page,/checkoutAuthorized&&detailsReady/);
});

test("hero is informational and FAQ names both tracking methods without invented guarantees",async()=>{
 const hero=await source("../components/LitixQuickShop.jsx");
 const page=await source("../app/page.jsx");
 assert.doesNotMatch(hero,/litix-platform-choices|litix-platform-tabs|Shop a Single Service/);
 assert.match(page,/Order Number \+ Checkout Email lookup form/);
 assert.match(page,/start times vary by service|start times vary/i);
 assert.match(page,/Eligible orders can begin processing within minutes/);
 assert.match(page,/Bookmark your private tracking link for one-click status updates/);
});
