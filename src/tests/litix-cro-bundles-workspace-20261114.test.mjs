import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {GROWTH_BUNDLES} from "../lib/growthBundles.mjs";
const file=path=>readFile(new URL(path,import.meta.url),"utf8");

test("every growth bundle retains the exact approved fixed price",()=>{
 const prices=[5382,10782,19782,35982];
 for(const platform of ["Instagram","TikTok"]){
  const tiers=GROWTH_BUNDLES.filter(x=>x.platform===platform);
  assert.deepEqual(tiers.map(x=>x.priceCents),prices);
 }
});

test("bundle selection has an active CTA with async readiness, bounded timeout, retry, and concierge",async()=>{
 const src=await file("../components/GrowthBundles.jsx");
 assert.match(src,/Continue to Secure Checkout/);
 assert.match(src,/onClick=\{continueCheckout\}/);
 assert.match(src,/controller\.abort\(\),5000/);
 assert.match(src,/Retry secure checkout/);
 assert.match(src,/WhatsApp Concierge/);
 assert.doesNotMatch(src,/Pay with PayKings — Unavailable|lg-bundle-disabled/);
 assert.match(src,/CURATED MULTI-POST BUNDLE/);
 const checkout=await file("../app/bundles/checkout/page.jsx");
 assert.match(checkout,/Retry PayKings verification/);
 assert.match(checkout,/WhatsApp Concierge/);
 assert.match(checkout,/checkingReadiness/);
 const backend=await file("../app/api/bundles/checkout/route.js");
 assert.match(backend,/FIRST_PARTY_SERVICE_NOT_ENABLED/);
 assert.match(backend,/chargeAttempted: false/);
});

test("catalog choices are bounded and session cache refresh never authorizes charging",async()=>{
 const route=await file("../app/api/catalog/checkout-choices/route.js");
 const ui=await file("../components/LitixCheckoutSelector.jsx");
 assert.match(route,/readDurableCatalog/);
 assert.match(route,/allBoosteroCardsSnapshot/);
 assert.match(route,/persistVerifiedCatalog/);
 assert.match(route,/maxDuration=20/);
 assert.match(ui,/CACHE_PREFIX/);
 assert.match(ui,/sessionStorage\.getItem/);
 assert.match(ui,/sessionStorage\.setItem/);
 assert.match(ui,/controller\.abort\(\),5000/);
 assert.match(ui,/liveAvailability:false/);
 assert.match(ui,/DEFAULT_PLATFORMS/);
 for(const name of ["Instagram","TikTok","YouTube","Facebook","Twitter (X)"])
  assert.ok(ui.includes(name));
});

test("homepage has one checkout entry and clean order steps; workspace is separate",async()=>{
 const home=await file("../app/page.jsx");
 const hero=await file("../components/LitixQuickShop.jsx");
 const route=await file("../app/workspace/page.jsx");
 const ws=await file("../components/LitixWorkspace.jsx");
 const css=await file("../app/style.css");
 assert.match(home,/className="litix-purchase-layout"/);
 assert.match(home,/href="\/workspace"/);
 assert.match(home,/href="\/bundles"/);
 assert.match(hero,/Shop a Single Service/);
 assert.match(hero,/Choose a Growth Bundle/);
 assert.equal((home.match(/<section id="checkout"/g)||[]).length,1);
 assert.equal((home.match(/<section className="panel tracking"/g)||[]).length,1);
 assert.equal((home.match(/<section className="panel growth-studio"/g)||[]).length,0);
 assert.equal((home.match(/<section className="panel campaign-studio"/g)||[]).length,0);
 assert.equal((home.match(/<section className="panel workspace"/g)||[]).length,0);
 assert.doesNotMatch(home,/>1\. Choose service<\/li>|>2\. Order details<\/li>|>3\. Secure payment<\/li>/);
 assert.match(home,/>Choose service<\/li>/);
 assert.match(home,/>Order details<\/li>/);
 assert.match(home,/>Secure payment<\/li>/);
 assert.match(css,/counter-reset:litix-checkout-step/);
 assert.match(css,/counter-increment:litix-checkout-step/);
 assert.ok(home.indexOf('id="how-it-works"')<home.indexOf('id="tracking"'));
 assert.match(route,/LitixWorkspace/);
 assert.match(ws,/Instant Browser Workspace/);
 assert.match(ws,/litix:campaigns/);
 assert.match(ws,/litix:favorites/);
 assert.match(ws,/litix:saved-orders/);
});

test("customer-facing copy is clear and avoids unverified automation claims",async()=>{
 const home=await file("../app/page.jsx");
 const bundles=await file("../components/GrowthBundles.jsx");
 const instructions=await file("../lib/growthBundles.mjs");
 assert.match(home,/Verified Real-Time Catalog/);
 assert.match(home,/Direct Order Processing/);
 assert.doesNotMatch(home,/Supplier-dependent delivery|Live supplier catalog|depends on the specific supplier service/);
 assert.doesNotMatch(home,/The supplier catalog is temporarily unavailable|Service checkout is paused until the supplier|This supplier service requires special order fields/);
 assert.doesNotMatch(bundles,/MANUALLY COORDINATED/);
 assert.doesNotMatch(instructions,/supplier-dependent/);
 assert.match(bundles,/before processing/);
});
