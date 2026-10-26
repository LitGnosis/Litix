import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GROWTH_BUNDLES,BUNDLE_KINDS,BUNDLE_INSTRUCTIONS,growthBundle,validPost,allocationsValid,configuredWhatsApp} from "../lib/growthBundles.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const price=[4485,8985,16485,29985];
const quantity=[
 [25000,100000,10000,1000,1000,100],
 [50000,250000,25000,2500,2500,250],
 [100000,500000,50000,5000,5000,500],
 [250000,1000000,100000,10000,10000,1000]];
test("eight fixed price packages and stable historic IDs",()=>{
 assert.equal(GROWTH_BUNDLES.length,8);
 for(const platform of ["Instagram","TikTok"]){
  const rows=GROWTH_BUNDLES.filter(x=>x.platform===platform);
  for(let i=0;i<4;i++){
   const p=rows[i];
   assert.equal(p.id,(platform==="Instagram"?"ig":"tt")+"_"+p.tier.toLowerCase());
   assert.equal(p.priceCents,price[i]);
   assert.deepEqual(BUNDLE_KINDS.map(k=>p.items[k]),quantity[i]);
   assert.equal(p.maxPosts,10);
  }
 }
 assert.equal(new Set(GROWTH_BUNDLES.map(x=>x.id)).size,8);
});
test("public post links are platform-bound and reject malformed URLs",()=>{
 assert.equal(validPost("https://www.instagram.com/p/CABC123/","Instagram"),true);
 assert.equal(validPost("https://www.tiktok.com/@creator/video/7493200000000000000","TikTok"),true);
 assert.equal(validPost("https://instagram.evil.com/p/a","Instagram"),false);
 assert.equal(validPost("https://www.tiktok.com/@creator/video/7493200000000000000","Instagram"),false);
 assert.equal(validPost("http://instagram.com/p/abcd","Instagram"),false);
});
test("cumulative quantities and ten-post cap are enforced",()=>{
 const p=growthBundle("ig_launch");const one={url:"https://instagram.com/p/a",Likes:25000};
 assert.equal(allocationsValid(p,[one]),true);
 assert.equal(allocationsValid(p,[one,{url:"https://instagram.com/reel/b",Likes:1}]),false);
 assert.equal(allocationsValid(p,[one,one]),false);
 assert.equal(allocationsValid(p,Array.from({length:11},(_,i)=>({url:"https://instagram.com/p/post"+i,Likes:1}))),false);
 assert.equal(allocationsValid(p,[{url:"https://instagram.com/p/a",Likes:-1}]),false);
});
test("all customer purchase entry points explain WhatsApp review and prevent default supplier dispatch",()=>{
 const home=read("app/page.jsx"),cards=read("components/GrowthBundles.jsx"),
 checkout=read("app/bundles/checkout/page.jsx"),receipt=read("app/bundles/confirmation/page.jsx"),
 order=read("app/api/bundles/checkout/route.js");
 assert.match(home,/<GrowthBundles\/>/);
 assert.match(cards,/BUNDLE_INSTRUCTIONS/);
 assert.match(checkout,/BUNDLE_INSTRUCTIONS/);
 assert.match(checkout,/type="checkbox" required/);
 assert.match(receipt,/data\.instructions/);
 assert.match(receipt,/whatsappUrl/);
 assert.match(BUNDLE_INSTRUCTIONS,/up to 10 posts/);
 assert.doesNotMatch(order,/action:"add"|action:'add'|smmglob\.com\/api\/v2/);
 assert.match(order,/verifyNmiSettlement/);
 assert.match(order,/on conflict\(idempotency_key\) do nothing/);
});
test("owner token, explicit post approval and unique supplier reservation gate every new dispatch",()=>{
 const admin=read("app/api/bundles/admin/route.js"),
 schema=read("db/migrations/20261026-growth-bundles-manual-fulfillment.sql");
 assert.match(admin,/LITIX_BUNDLES_ADMIN_TOKEN/);
 assert.match(admin,/sameOrigin\(req\)/);
 assert.match(admin,/post\.status!=="Under Review"/);
 assert.match(admin,/OWNER_CONFIRMED_MANUAL_DELIVERY/);
 assert.match(admin,/Automated supplier dispatch is disabled/);
 assert.doesNotMatch(admin,/fetch\("https:\/\/smmglob\.com/);
 assert.match(admin,/markManualProcessing/);
 assert.match(admin,/markManualCompleted/);
 assert.match(admin,/UNKNOWN_OUTCOME|status:"unknown"/);
 assert.match(schema,/unique\(post_id,kind\)/);
 assert.match(schema,/litix_bundle_save_post/);
 assert.match(schema,/MAX_TEN_POSTS/);
 assert.match(schema,/BUNDLE_QUOTA_EXCEEDED/);
});
test("no guessed WhatsApp number and no changed ordinary checkout",()=>{
 const original=read("app/api/[action]/route.js"),catalog=read("app/api/bundles/route.js");
 assert.match(original,/https:\/\/paykings\.transactiongateway\.com\/api\/transact\.php/);
 assert.match(original,/notifyPaid/);
 assert.match(original,/supplier_attempted_at/);
 assert.doesNotMatch(catalog,/19452106315/);
 assert.equal(configuredWhatsApp(),null);
 assert.match(catalog,/checkoutEnabled:ready/);
});
