import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {premiumDefaultServices,filterPremiumCards,PREMIUM_CATALOG_PRIORITY,priceAt60Percent} from "../lib/boosteroPremiumCatalog.mjs";

const platforms=["Instagram","TikTok","YouTube","Facebook","X Twitter","Spotify","Telegram","Snapchat","LinkedIn","Discord","Pinterest","Twitch","Reddit","Kick"];
const kinds=["Followers","Likes","Views"];
function synthetic864(){
 return Array.from({length:864},(_,i)=>({
  service:100000+i,type:"Default",
  name:platforms[i%platforms.length]+" "+kinds[Math.floor(i/platforms.length)%kinds.length],
  category:platforms[i%platforms.length],
  rate:1+(i%17)*0.05,min:10,max:250000,step:1,
  refill:false
 }));
}
test("864-item fixture across fourteen platforms remains preview-only and supplier-ID unique",()=>{
 const raw=synthetic864(),items=premiumDefaultServices(raw);
 // The fixture models likely valid supplier rows, not a claim that any such 864 live IDs exist.
 assert.equal(items.length,864);
 assert.equal(new Set(items.map(x=>x.id)).size,864);
 assert.equal(new Set(items.map(x=>x.platform)).size,14);
 assert.deepEqual([...new Set(items.map(x=>x.category))].slice(0,4),PREMIUM_CATALOG_PRIORITY);
 for(const item of items){
  assert.equal(item.purchasable,false);
  assert.equal(item.previewOnly,true);
  assert.ok(item.startingAmountCents>=500);
  assert.ok(item.min>=item.supplierMin&&item.min<=item.max);
  assert.ok(Number.isFinite(item.per1000)&&item.per1000>0);
  assert.ok(!("wholesale" in item)&&!("apiKey" in item));
 }
 assert.equal(filterPremiumCards(items,new URLSearchParams("page=1")).items.length,24);
 assert.equal(filterPremiumCards(items,new URLSearchParams("page=36")).items.length,24);
 assert.equal(filterPremiumCards(items,new URLSearchParams("page=37")).items.length,0);
});
test("unapproved or unsafe supplier service shapes cannot become purchasable",()=>{
 const valid=synthetic864()[0];
 const bad=[
  {...valid,service:999001,type:"Custom Comments"},
  {...valid,service:999002,name:"Instagram Auto Likes Subscription"},
  {...valid,service:999003,name:"Instagram Followers and Likes"},
  {...valid,service:999004,rate:-1},
  {...valid,service:999005,min:1000,max:1},
  {...valid,service:"../bad"},
  {...valid,service:999007,name:"Instagram Title Search Views"},
  {...valid,service:999008,quantity_step:0}
 ];
 const items=premiumDefaultServices([valid,...bad]);
 assert.deepEqual(items.map(x=>x.id),["boostero_"+valid.service]);
});
test("supplier rate calculations never silently change approved production prices",()=>{
 const fixtures=[{rate:1.25,qty:3125},{rate:3.08,qty:1042},{rate:2.99,qty:1700}];
 for(const {rate,qty} of fixtures){
  const q=priceAt60Percent(rate,qty);
  assert.ok(q.retailCents>=Math.ceil(rate*qty/1000*100));
  assert.ok(Math.abs(q.per1000-rate*1.6)<1e-7);
 }
 const prod=readFileSync(new URL("../app/api/catalog/v1/route.js",import.meta.url),"utf8");
 const draft=readFileSync(new URL("../app/api/premium/catalog/route.js",import.meta.url),"utf8");
 assert.match(draft,/purchasingEnabled:false/);
 assert.match(draft,/previewOnly/);
 assert.doesNotMatch(draft,/boosteroProduction\("add"/);
 assert.match(prod,/boosteroOnly:true/);
});
