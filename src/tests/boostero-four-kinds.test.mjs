import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {restrictedSocialKind} from "../lib/publicBoosteroOnly.mjs";
import {boosteroCompatibleServices} from "../lib/boosteroReadOnly.mjs";
import {boosteroQuote,boosteroDestination} from "../lib/boosteroFulfillment.mjs";
import {buildActiveStorefrontCatalog} from "../lib/activeStorefrontCatalog.mjs";
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("four featured service kinds are recognized without accidentally classifying other platforms",()=>{
 const names=[
  ["Instagram Followers","instagram followers"],
  ["Instagram Likes","instagram likes"],
  ["TikTok Followers","tiktok followers"],
  ["TikTok Likes","tiktok likes"]
 ];
 for(const [name,kind] of names)assert.equal(restrictedSocialKind({name,category:name}),kind);
 for(const name of ["Instagram Views","YouTube Followers","Spotify Plays","TikTok Shares"])
  assert.equal(restrictedSocialKind({name,category:name}),null);
});

test("Boostero normalizer rejects subscriptions and incompatible shapes from the four live cards",()=>{
 const provider=[
  {service:5461,name:"Instagram Followers",category:"Instagram Followers",rate:2,min:100,max:10000,type:"Default"},
  {service:4751,name:"Instagram Likes",category:"Instagram Likes",rate:2,min:100,max:10000,type:"Default"},
  {service:5101,name:"TikTok Followers",category:"TikTok Followers",rate:2,min:100,max:10000,type:"Default"},
  {service:5251,name:"TikTok Likes",category:"TikTok Likes",rate:2,min:100,max:10000,type:"Default"},
  {service:9001,name:"Instagram Auto Likes",category:"Instagram Likes",rate:2,min:100,max:10000,type:"Subscriptions"},
  {service:9002,name:"Instagram Followers Package",category:"Instagram Followers",rate:2,min:1,max:1,type:"Package"},
  {service:9003,name:"YouTube Views",category:"YouTube Views",rate:2,min:100,max:10000,type:"Default"},
 ];
 assert.deepEqual(boosteroCompatibleServices(provider).map(x=>x.id),["5461","4751","5101","5251"]);
});

test("unapproved supplier IDs cannot pass pricing, and checkout targets must be valid",()=>{
 const service={id:"5461",platform:"Instagram",kind:"followers",min:100,max:10000,
  wholesalePer1000USD:2,name:"Instagram Followers",category:"Instagram Followers",refillClaim:false};
 assert.throws(()=>boosteroQuote({service,approved:{enabled:false},quantity:1000}),/not_approved/);
 assert.throws(()=>boosteroQuote({service,approved:{enabled:true,supplier_service_id:"999"},quantity:1000}),/mapping_changed/);
 assert.equal(boosteroDestination("@litixsocial","instagram","followers"),"https://www.instagram.com/litixsocial/");
 assert.equal(boosteroDestination("https://evil.example.com/post","instagram","likes"),null);
 assert.equal(boosteroDestination("http://instagram.com/p/abcdef","instagram","likes"),null);
});

test("the public checkout and catalog never expose a numeric retired service for payment",()=>{
 const checkout=file("app/api/checkout/v1/route.js");
 const catalog=file("app/api/catalog/v1/route.js");
 const page=file("app/page.jsx");
 assert.match(checkout,/Only verified Boostero services are available/);
 assert.match(catalog,/enabledBoosteroCards/);
 assert.match(page,/Global Catalog/);
 const invalid=[
  {id:"123",category:"Instagram Followers",purchasable:true,per1000:5,startingAmountCents:500},
  {id:"boostero_123",category:"Instagram Followers",purchasable:false,per1000:5,startingAmountCents:500}
 ];
 assert.equal(buildActiveStorefrontCatalog(invalid,new URLSearchParams()).total,0);
});
