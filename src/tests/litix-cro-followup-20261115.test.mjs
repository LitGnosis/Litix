import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {normalizeProfileDestination} from "../lib/litixOrderTarget.mjs";
import {curatedQuantityBadge} from "../lib/litixCuratedSavings.mjs";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("curated quality pills are distinct and avoid unsupported promises",async()=>{
 const x=await source("../components/CuratedFastCheckout.jsx");
 assert.match(x,/litix-tier-name">Standard/);
 assert.match(x,/litix-tier-name">Active option/);
 assert.match(x,/live\(platform,kind,"vip"\)/);
 assert.doesNotMatch(x,/High QualityStandard|Add 30-Day Auto-Likes/);
 assert.match(x,/not verified drop rates, profile pictures or refill guarantees/);
});
test("premium CTA remains PayKings-hosted with one trust row and a safe sticky mobile shortcut",async()=>{
 const [p,home,css]=await Promise.all([source("../components/PremiumInlineCheckout.jsx"),
  source("../app/page.jsx"),source("../app/quick-checkout.css")]);
 assert.match(p,/id="ccnumber"/);assert.match(p,/id="ccexp"/);assert.match(p,/id="cvv"/);
 assert.match(p,/type="submit"/);assert.match(p,/litix-mobile-checkout-bar/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(home,/Pay with PayKings/);assert.match(home,/\/api\/checkout\/v1/);
 assert.match(home,/LitixProfilePreview/);
 assert.doesNotMatch(home,/[✦◇✧◆☏]/);
 assert.doesNotMatch(p,/[✦◇✧◆☏]/);
});
test("Auto-Likes is not silently included in one-time paid orders",async()=>{
 const [checkout,curated,retired]=await Promise.all([source("../app/api/checkout/v1/route.js"),
  source("../lib/curatedCatalog.mjs"),source("../lib/retiredAutolikes.mjs")]);
 assert.match(checkout,/data\?\.autoLikes===true/);
 assert.match(checkout,/Recurring Auto-Likes is not currently available/);
 assert.match(checkout,/handleBoosteroOrder/);
 assert.match(curated,/autoLikesEnabled:false,autoViewsEnabled:false/);
 assert.match(retired,/retiredAutoLikesService/);
});
test("package labels never invent a discount and the highest tier gets a badge only with live proof",()=>{
 const cards=[{quantity:100,totalCents:111,available:true},
  {quantity:1000,totalCents:1102,available:true},
  {quantity:5000,totalCents:5510,available:true}];
 assert.equal(curatedQuantityBadge(cards,1000,{live:true}),"FEATURED");
 assert.equal(curatedQuantityBadge(cards,5000,{live:true}),"MAX REACH");
 const proved=[{quantity:100,totalCents:200,available:true},
  {quantity:5000,totalCents:7500,available:true}];
 assert.match(curatedQuantityBadge(proved,5000,{live:true}),/^Save \$/);
});
test("public profile URLs normalize without any password request",()=>{
 assert.deepEqual(normalizeProfileDestination("@litixsocial","instagram"),
  {ok:true,url:"https://www.instagram.com/litixsocial/"});
 assert.deepEqual(normalizeProfileDestination("https://www.tiktok.com/@litixsocial?lang=en","tiktok"),
  {ok:true,url:"https://www.tiktok.com/@litixsocial"});
 assert.equal(normalizeProfileDestination("https://evil.test/@litixsocial","instagram").ok,false);
});
