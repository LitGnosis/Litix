import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DEFAULT_CURATED_SKU,initialCuratedOffer,curatedPresetQuantity,formatCuratedUnitRange} from "../lib/litixCuratedFirstPaint.mjs";
import {verifiedVolumeSavings,curatedQuantityBadge} from "../lib/litixCuratedSavings.mjs";
import {LITIX_SEO_LANDINGS,seoLanding,seoLandingMetadata} from "../lib/litixSeoLandings.mjs";
const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("default featured Instagram 1,000 displays curated $10.99 before live price verification",async()=>{
 assert.equal(DEFAULT_CURATED_SKU,"curated_instagram_followers_standard");
 const selected=initialCuratedOffer();
 assert.equal(selected.platform,"Instagram");
 assert.equal(selected.kind,"followers");
 assert.equal(selected.preview,true);
 assert.equal(selected.purchasable,false);
 assert.equal(selected.per1000,11.02);
 assert.equal(curatedPresetQuantity(selected),1000);
 assert.equal(selected.quantityCards.find(x=>x.quantity===1000).totalCents,1099);
 assert.equal(formatCuratedUnitRange(90,5000),"90–5,000 units");
 const [home,selector]=await Promise.all([source("../app/page.jsx"),source("../components/CuratedFastCheckout.jsx")]);
 assert.match(home,/useState\(CURATED_HOME_ENABLED\?firstPaintOffer:INITIAL_FAST_SERVICE\)/);
 assert.match(home,/useState\(CURATED_HOME_ENABLED\?curatedPresetQuantity\(firstPaintOffer\):INITIAL_FAST_QUANTITY\)/);
 assert.doesNotMatch(home,/setQty\(0\)/);
 assert.doesNotMatch(home,/Choose a package in Step 03\./);
 assert.doesNotMatch(home,/Choose a package to continue/);
 assert.doesNotMatch(home,/Preparing the focused checkout/);
 assert.match(selector,/initialServiceId=DEFAULT_CURATED_SKU/);
 assert.match(selector,/formatCuratedUnitRange\(current.min,current.max\)/);
 assert.match(selector,/useState\(STATIC_CURATED_PREVIEW\)/);
});
test("volume savings badges never advertise nonexistent percentage discounts",()=>{
 const flat=[100,250,500,1000,2500,5000].map(quantity=>({
  quantity,totalCents:Math.ceil(11.02*quantity/10),available:true
 }));
 for(const quantity of [1000,2500,5000]){
  assert.equal(verifiedVolumeSavings(flat,quantity),null);
  assert.doesNotMatch(String(curatedQuantityBadge(flat,quantity,{live:true})),/Save \d+%/);
 }
 assert.equal(curatedQuantityBadge(flat,1000,{live:false}),"FEATURED");
 assert.equal(curatedQuantityBadge(flat,2500,{live:false}),"MORE REACH");
 assert.equal(curatedQuantityBadge(flat,5000,{live:false}),"MAX REACH");
 const discounted=[
  {quantity:100,totalCents:200,available:true},
  {quantity:250,totalCents:500,available:true},
  {quantity:500,totalCents:1000,available:true},
  {quantity:1000,totalCents:1800,available:true},
  {quantity:2500,totalCents:4000,available:true},
  {quantity:5000,totalCents:7500,available:true}
 ];
 assert.equal(curatedQuantityBadge(discounted,1000,{live:true}),"FEATURED");
 assert.equal(curatedQuantityBadge(discounted,2500,{live:true}),"SAVE 11%");
 assert.equal(curatedQuantityBadge(discounted,5000,{live:true}),"BEST VALUE · SAVE 17%");
});
test("4 canonical SEO pages are static, unique, visible FAQ JSON-LD, and share real checkout",async()=>{
 const slugs=["buy-instagram-followers","buy-instagram-likes","buy-tiktok-followers","buy-tiktok-likes"];
 assert.deepEqual(Object.keys(LITIX_SEO_LANDINGS),slugs);
 const titles=new Set();
 for(const slug of slugs){
  const p=seoLanding(slug),m=seoLandingMetadata(slug);
  assert.equal(m.alternates.canonical,"https://www.litix.net/"+slug);
  assert.equal(m.robots.index,true);
  assert.equal(p.faq.length,5);
  assert.equal(p.checklist.length,4);
  assert.match(p.sku,/^curated_(instagram|tiktok)_(followers|likes)_standard$/);
  titles.add(p.title);
  const entry=await source("../app/"+slug+"/page.jsx");
  assert.match(entry,/export function generateMetadata\(\)/);
  assert.match(entry,new RegExp('slug="'+slug+'"'));
  assert.doesNotMatch(entry,/force-dynamic|noindex/);
 }
 assert.equal(titles.size,4);
 const seo=await source("../components/LitixSeoLanding.jsx");
 const sitemap=await source("../app/sitemap.js");
 assert.match(seo,/"@type":"FAQPage"/);
 assert.match(seo,/mainEntity:page.faq.map/);
 assert.match(seo,/<Home landingServiceId=\{page.sku\}\/>/);
 assert.match(seo,/page.faq.map\(entry/);
 assert.match(sitemap,/Object.keys\(LITIX_SEO_LANDINGS\)/);
});
test("activity ticker requires observed successful payment and supplier IDs, never invented review numbers",async()=>{
 const [api,proof]=await Promise.all([
  source("../app/api/public-activity/route.js"),
  source("../components/LitixVerifiedActivity.jsx")
 ]);
 assert.match(api,/o.payment_state='paid'/);
 assert.match(api,/f.supplier_order_id is not null/);
 assert.match(api,/count<5/);
 assert.match(proof,/data\?\.available===true/);
 assert.doesNotMatch(proof,/4\.9|1,400|Verified order: 2,500/);
});
