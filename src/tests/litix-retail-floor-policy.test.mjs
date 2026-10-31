import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LITIX_RETAIL_MARKUP,LITIX_MINIMUM_CHARGE_CENTS,litixRateFloorCents,
 litixRetailPer1000Cents,litixOrderCents,litixPurchasableDefault,litixServiceMinimum}
 from "../lib/litixRetail60.mjs";

const service=(name,rate,min=100,max=100000)=>({
 service:"5251",name,category:name,type:"Default",rate,min,max
});

test("all Instagram/TikTok Likes sell for at least $6 per 1,000, never cheaper",()=>{
 for(const name of ["Instagram Likes","TikTok Likes","IG Reels Likes","TikTok USA Active Likes"]){
  for(const rate of [0.05,0.15,0.68,1,3.749]){
   const item=service(name,rate);
   const price=litixRetailPer1000Cents(rate,item);
   assert.ok(price>=600,{name,rate,price});
   assert.equal(litixRateFloorCents(item),600);
  }
 }
 assert.equal(litixRetailPer1000Cents(0.68,service("TikTok Likes",0.68)),600);
 assert.equal(litixRetailPer1000Cents(1,service("Instagram Likes",1)),600);
});

test("all Instagram/TikTok Followers sell for at least $9 per 1,000",()=>{
 for(const name of ["Instagram Followers","TikTok Followers","IG USA Followers","TikTok Premium Followers"]){
  assert.equal(litixRateFloorCents(service(name,0.2)),900);
  assert.equal(litixRetailPer1000Cents(.2,service(name,.2)),900);
 }
 assert.equal(litixRetailPer1000Cents(4,service("TikTok Followers",4)),900);
});

test("every other purchasable service has a $3/1,000 floor, not $6 or $9",()=>{
 for(const name of ["YouTube Views","TikTok Views","Instagram Saves","Facebook Followers",
                    "Spotify Plays","TikTok Comments","Other Likes","Website Traffic"]){
  assert.equal(litixRateFloorCents(service(name,0.1)),300,name);
  assert.equal(litixRetailPer1000Cents(0.1,service(name,0.1)),300,name);
 }
 assert.equal(litixRetailPer1000Cents(0.5),300);
});

test("never lower a service already above its floor or change the 60% baseline",()=>{
 assert.equal(LITIX_RETAIL_MARKUP,1.6);
 for(const [name,rate,expected] of [
  ["Instagram Likes",5,800],
  ["TikTok Likes",10,1600],
  ["Instagram Followers",8,1280],
  ["TikTok Followers",10,1600],
  ["YouTube Views",4,640],
  ["Facebook Likes",2,320],
  ["Other Service",20,3200]
 ]){
  assert.equal(litixRetailPer1000Cents(rate,service(name,rate)),expected,name);
 }
});

test("catalog minimums and checkout totals use the same floored price and preserve $1 minimum",()=>{
 assert.equal(LITIX_MINIMUM_CHARGE_CENTS,100);
 for(const [name,rate,per1000,minimum] of [
  ["TikTok Likes",.68,600,167],
  ["Instagram Likes",.15,600,167],
  ["TikTok Followers",1.0,900,112],
  ["Instagram Followers",1.2,900,112],
  ["YouTube Views",.1,300,334]
 ]){
  const row=service(name,rate);
  assert.equal(litixRetailPer1000Cents(rate,row),per1000,name);
  assert.equal(litixPurchasableDefault(row),minimum,name);
  assert.equal(litixOrderCents(per1000,1000),per1000,name);
  assert.equal(litixOrderCents(per1000,minimum),Math.ceil(minimum*per1000/1000-1e-8),name);
  assert.ok(litixOrderCents(per1000,minimum)>=100);
  assert.equal(litixServiceMinimum(100,100000,per1000),minimum);
 }
});

test("same service-aware floor is applied in both catalog surfaces and charged server quote",()=>{
 const root=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const catalog=root("lib/boosteroCatalog.mjs");
 const checkout=root("lib/boosteroFulfillment.mjs");
 const global=root("app/api/catalog/global/route.js");
 assert.match(catalog,/litixRetailPer1000Cents\(item\.rate,item\)/);
 assert.match(checkout,/litixRetailPer1000Cents\(rate,service\)/);
 assert.match(global,/litixRetailPer1000Cents\(rate,raw\)/);
 const orderHandler=root("lib/boosteroOrderHandler.mjs");
 assert.match(orderHandler,/verifyBoosteroQuote\(id,quoteQuantity,sql\)/);
 assert.match(orderHandler,/Number\(data\?\.expectedAmountCents\)!==quote\.amountCents/);
 assert.match(orderHandler,/totalCents\+=one\.amountCents/);
});
