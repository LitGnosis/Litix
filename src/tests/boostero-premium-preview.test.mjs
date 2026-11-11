import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {premiumDefaultServices,priceAt60Percent,litixPreviewRate,safeBoosteroLink,filterPremiumCards,PREMIUM_CATALOG_PRIORITY} from "../lib/boosteroPremiumCatalog.mjs";
const sample=[
 {service:5461,name:"Instagram Premium Followers",category:"Instagram - Followers",rate:3,min:10,max:500000,type:"Default",refill:false},
 {service:4751,name:"Instagram Likes Quality",category:"Instagram - Likes",rate:0.147,min:100,max:1000000,type:"Default",refill:false},
 {service:5101,name:"TikTok Followers Premium",category:"TikTok - Followers",rate:2.095,min:10,max:500000,type:"Default",refill:false},
 {service:5251,name:"TikTok Likes High Quality",category:"TikTok - Likes",rate:0.68,min:10,max:100000,type:"Default",refill:false},
 {service:4771,name:"YouTube Likes High Quality",category:"YouTube Likes",rate:0.462,min:50,max:500000,type:"Default",refill:false},
 {service:90001,name:"YouTube Custom Comments",category:"YouTube Comments",rate:5,min:10,max:100000,type:"Custom Comments"},
 {service:90002,name:"YouTube Title Search Views",category:"YouTube Search",rate:2,min:100,max:100000,type:"Default"},
 {service:90003,name:"Instagram Likes and Views",category:"Instagram Likes",rate:0.9,min:100,max:500000,type:"Default"},
 {service:90004,name:"Discord Members",category:"Discord Members",rate:2,min:10,max:10,type:"Default"}
];
test("exact 60% gross retail price before inevitable cent rounding",()=>{
 assert.deepEqual(priceAt60Percent(1,1000),{per1000:1.6,retailCents:160,minimumCents:500});
 assert.equal(priceAt60Percent(5,1000).retailCents,800);
 assert.equal(priceAt60Percent(10,1000).retailCents,1600);
 assert.equal(priceAt60Percent(25,1000).retailCents,4000);
 assert.equal(priceAt60Percent(3,1042).retailCents,501);
 assert.equal(priceAt60Percent(0.147,22000).retailCents,518);
 assert.throws(()=>priceAt60Percent(0,1000),/invalid/);
 assert.throws(()=>priceAt60Percent(1,1000.5),/invalid/);
});
test("only compatible real supplier Default services; no invented special forms or impossible $5 orders",()=>{
 const list=premiumDefaultServices(sample);
 assert.deepEqual(list.slice(0,4).map(x=>x.id),["boostero_5461","boostero_4751","boostero_5101","boostero_5251"]);
 assert.equal(list.some(x=>x.id==="boostero_4771"),true);
 assert.ok(!list.some(x=>["boostero_90001","boostero_90002","boostero_90003","boostero_90004"].includes(x.id)));
 assert.equal(list[0].min,334);
 assert.equal(list[1].min,1000);
 assert.equal(list[0].per1000,15);
 assert.equal(list[1].per1000,5);
 assert.ok(list.every(x=>x.previewOnly===true&&x.purchasable===false&&x.startingAmountCents>=500));
});
test("new previews use full existing 8x/5x/2x Litix wholesale markup and $5 per-1000 floor",()=>{
 assert.equal(litixPreviewRate(0.147),500);
 assert.equal(litixPreviewRate(0.9),720);
 assert.equal(litixPreviewRate(3),1500);
 assert.equal(litixPreviewRate(20),4000);
 assert.equal(litixPreviewRate(25),5000);
 assert.throws(()=>litixPreviewRate(-1),/invalid/);
 const all=premiumDefaultServices([
  {service:40101,name:"Instagram Comments",category:"Instagram Comments",type:"Default",rate:1,min:100,max:50000},
  {service:40102,name:"TikTok Shares",category:"TikTok Shares",type:"Default",rate:0.8,min:100,max:50000},
  {service:40103,name:"YouTube Impressions",category:"YouTube Impressions",type:"Default",rate:3,min:100,max:50000},
  {service:40104,name:"Instagram AutoLikes Subscriptions",category:"Instagram",type:"Subscriptions",rate:1,min:10,max:50000},
  {service:40105,name:"TikTok Shares",category:"TikTok Shares",type:"Default",rate:0.8,min:100,max:50000}
 ]);
 assert.deepEqual(all.map(x=>x.id),["boostero_40101","boostero_40102","boostero_40103"]);
 assert.ok(all.every(x=>!x.purchasable&&x.previewOnly&&x.startingAmountCents>=500));
});
test("retail-only API payload and priority filter; no wholesale rates or supplier API keys",()=>{
 const list=premiumDefaultServices(sample);
 const view=filterPremiumCards(list,new URLSearchParams("platform=Instagram&category=Instagram%20Likes&page=1"));
 assert.deepEqual(view.items.map(x=>x.id),["boostero_4751"]);
 assert.deepEqual(view.categories.slice(0,4),PREMIUM_CATALOG_PRIORITY);
 assert.ok(!JSON.stringify(view).includes("wholesalePer1000USD"));
 assert.ok(!JSON.stringify(view).includes("BOOSTERO_API_KEY"));
 assert.deepEqual(filterPremiumCards(list,new URLSearchParams("q=Boostero_DOES_NOT_EXIST")).items,[]);
});
test("profile/like/video links reject unsafe, unrelated, direct admin and impersonated hosts",()=>{
 assert.equal(safeBoosteroLink("https://instagram.com/example","Instagram","Followers"),"https://www.instagram.com/example/");
 assert.equal(safeBoosteroLink("https://www.instagram.com/reel/ABc12345/","Instagram","Likes"),"https://www.instagram.com/reel/ABc12345/");
 assert.equal(safeBoosteroLink("https://tiktok.com/@example/video/1234567890123","TikTok","Likes"),"https://www.tiktok.com/@example/video/1234567890123");
 assert.equal(safeBoosteroLink("https://www.youtube.com/watch?v=aBc1234DeF5","YouTube","Views"),"https://www.youtube.com/watch?v=aBc1234DeF5");
 for(const bad of ["http://www.instagram.com/test","https://instagram.com.evil.com/p/ABCdef123/",
  "https://instagram.com/p/ABCdef123/?token=secret","https://www.tiktok.com/@test/video/123?bad=1",
  "https://localhost/","javascript:alert(1)"]){
  assert.equal(safeBoosteroLink(bad,"Instagram","Likes"),null);
 }
});
test("preview-only catalog endpoint must have a hard production flag and no write action",()=>{
 const route=readFileSync(new URL("../app/api/premium/catalog/route.js",import.meta.url),"utf8");
 assert.match(route,/LITIX_PREMIUM_BOOSTERO_LIVE/);
 assert.match(route,/boosteroReadOnly\("services"\)/);
 assert.match(route,/purchasingEnabled:false/);
 assert.doesNotMatch(route,/boosteroProduction\("add"/);
 const page=readFileSync(new URL("../app/premium-preview/page.jsx",import.meta.url),"utf8");
 assert.match(page,/Checkout unavailable until security and payment validation pass/);
 assert.match(page,/safeBoosteroLink/);
 assert.match(page,/Frequently asked questions/);
});

test("premium public preview hides supplier IDs and exposes accurate platform totals",()=>{
 const endpoint=readFileSync(new URL("../app/api/premium/catalog/route.js",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/premium-preview/page.jsx",import.meta.url),"utf8");
 assert.match(endpoint,/publicItems=view\.items\.map\(\(\{id,\.\.\.fields\}\)/);
 assert.match(endpoint,/platformCounts/);
 assert.match(endpoint,/totalAll:cards\.length/);
 assert.match(page,/key=\{s\.displayKey\}/);
 assert.match(page,/premium-platform-count/);
 assert.doesNotMatch(page,/key=\{s\.id\}/);
});
