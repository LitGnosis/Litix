import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {guidedLitixReply} from "../lib/litixGuidedSupport.mjs";
const source=async name=>readFile(new URL(name,import.meta.url),"utf8");

test("checkout selector reads durable catalog first and stops loading on timeout",async()=>{
 const api=await source("../app/api/catalog/checkout-choices/route.js");
 const ui=await source("../components/LitixCheckoutSelector.jsx");
 assert.ok(api.indexOf("readDurableCatalog()")<api.indexOf("allBoosteroCardsSnapshot()"));
 assert.match(ui,/setTimeout\(\(\)=>ctrl\.abort/);
 assert.match(ui,/setRefreshing\(false\)/);
 assert.match(ui,/choicesForPlatform/);
 assert.match(ui,/Retry services/);
});

test("link and private order lookup fields exist on main page",async()=>{
 const src=await source("../app/page.jsx");
 assert.match(src,/aria-label="Public profile or post link"/);
 assert.match(src,/!multiMode&&<label className="litix-early-link"/);
 assert.match(src,/aria-label="Litix order number"/);
 assert.match(src,/aria-label="Checkout email"/);
 assert.match(src,/fetch\("\/api\/order-lookup"/);
 assert.match(src,/onSubmit=\{trackByNumber\}/);
});

test("AI has a visible working launcher and explicitly guided fallback",async()=>{
 const hero=await source("../components/LitixQuickShop.jsx");
 const ai=await source("../components/LitixAI.jsx");
 const api=await source("../app/api/litix-ai/route.js");
 const css=await source("../app/litix-ai.css");
 assert.match(hero,/Social Growth for Creators, Brands & Agencies/);
 assert.match(ai,/addEventListener\("litix:open-ai"/);
 assert.match(ai,/setOpen\(true\)/);
 assert.match(api,/available:true,mode:configured\(\)\?"ai":"guided"/);
 assert.match(api,/guidedLitixReply/);
 assert.match(css,/Keep the text visible/);
 assert.doesNotMatch(css,/body:has\(#checkout\) \.lxai-launcher > span:not\(\.lxai-orb\)\{display:none\}/);
});

test("guidance never invents live order status or processes payment",()=>{
 assert.match(guidedLitixReply("track my order"),/order number and the checkout email/i);
 assert.match(guidedLitixReply("your Instagram likes price"),/Prices and supplier availability are verified/i);
 assert.match(guidedLitixReply("can I get a bundle"),/no longer sells Growth Bundles/);
 assert.doesNotMatch(guidedLitixReply("who charged me"),/refunded successfully|order fulfilled/i);
});

test("Facebook is a working hero tab and homepage removes repetitive CTAs",async()=>{
 const hero=await source("../components/LitixQuickShop.jsx");
 const home=await source("../app/page.jsx");
 assert.match(hero,/Facebook or X service/);
 const selector=await source("../components/LitixCheckoutSelector.jsx");
 assert.match(selector,/CHECKOUT_PLATFORMS/);
 assert.match(selector,/LITIX_CUSTOM_QUICK_PICKS/);
 assert.doesNotMatch(home,/className="panel support-banner"/);
 assert.doesNotMatch(home,/aria-label="Litix customer support"/);
 const ws=await source("../components/LitixWorkspace.jsx");
 assert.doesNotMatch(home,/id="campaign-studio"|id="growth-studio"|id="workspace"/);
 assert.match(home,/href="\/workspace"/);
 assert.match(ws,/7-day content sprint/);
 assert.match(ws,/Client outreach/);
 assert.match(home,/Open full order tracking/);
});
