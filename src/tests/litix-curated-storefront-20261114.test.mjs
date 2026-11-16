import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {CORE_KINDS,CORE_PLATFORMS,CORE_QUANTITIES} from "../config/curatedServices.mjs";
import {
 tiktokSkuForService,strictTikTok35Service,curatedTikTokRateCents,
 curatedTikTokTotalCents,resolveExactTikTokServices
} from "../lib/tiktokCatalog.mjs";
import {litixRetailPer1000Cents,litixCuratedPricingActive} from "../lib/litixRetail60.mjs";
import {boosteroQuote} from "../lib/boosteroFulfillment.mjs";
import {curatedPublicProduct,resolveCuratedSupplier,parseCuratedId} from "../lib/curatedCatalog.mjs";
import {quoteCentsForQuantity} from "../lib/litixCheckoutDisplay.mjs";

const source=path=>readFile(new URL(path,import.meta.url),"utf8");
const row=(service,name,rate="2.00",kind="default")=>({
 service,name,rate,category:"TikTok - "+name.split(" ")[1],type:kind,min:"100",max:"10000",
 refill:false
});
const example=[
 row(11111,"NEW TikTok Followers [ High Quality | 10K/Day | 30 Days Manual Refill ]"),
 row(11112,"NEW TikTok Likes [ Real Accounts | 5K/Day | Non Drop ]","8.00"),
 row(11113,"TikTok Views [ Premium Quality | 100K/Day | 30 Days Manual Refill ]","1.00"),
 row(11114,"TikTok Random Comments [ Real Accounts | 500/Day | Non Drop ]","9.00"),
 row(11115,"NEW TikTok Custom Comments [ High Quality | 5K/Day | Non Drop ]","8.00","Custom Comments"),
 row(11116,"TikTok Shares [ High Quality | 10K/Day | 30 Days Manual Refill ]","2.00"),
 row(11117,"TikTok Saves [ High Quality | 10K/Day | Non Drop ]","3.00"),
 row(11118,"NEW TikTok Story Views (All Stories) [ High Quality | 10K/Day | Non Drop ]","1.00")
];

test("8 core links, six quantity cards, server-only supplier mapping",async()=>{
 assert.deepEqual(CORE_PLATFORMS,["Instagram","TikTok"]);
 assert.deepEqual(CORE_KINDS,["followers","likes","views","comments"]);
 assert.deepEqual(CORE_QUANTITIES,[100,250,500,1000,2500,5000]);
 for(const x of example){
  assert.match(String(tiktokSkuForService(x)),/^tiktok_/);
 }
 assert.equal(tiktokSkuForService({...example[0],name:"Followers",category:example[0].name}),"tiktok_followers");
 assert.equal(tiktokSkuForService({...example[0],name:"TikTok Likes",category:example[0].name}),null,
  "A category labeled Followers must not accidentally map a Likes service as Followers");

 assert.equal(strictTikTok35Service(example[4]),false,"custom comments not purchasable by Default API");
 const match=resolveExactTikTokServices(example);
 assert.equal(match.tiktok_followers.service,11111);
 assert.equal(match.tiktok_comments.service,11114);
 assert.equal(resolveCuratedSupplier(example,"TikTok","comments")?.service,11114);
 assert.equal(resolveCuratedSupplier(example,"TikTok","likes","vip"),null);
 assert.deepEqual(parseCuratedId("curated_tiktok_likes_standard"),{platform:"TikTok",kind:"likes",tier:"standard"});
 assert.equal(parseCuratedId("curated_tiktok_auto_likes_standard"),null);
});

test("35 percent TikTok exact matching is feature-gated, never changes Instagram",()=>{
 const previous=process.env.LITIX_CURATED_TIKTOK_35_ENABLED;
 try{
  delete process.env.LITIX_CURATED_TIKTOK_35_ENABLED;
  assert.equal(litixCuratedPricingActive(example[0]),false);
  assert.equal(litixRetailPer1000Cents(2,example[0]),900,"existing floor and 60% preserved with flag off");
  process.env.LITIX_CURATED_TIKTOK_35_ENABLED="true";
  assert.equal(curatedTikTokRateCents(2),270);
  assert.equal(curatedTikTokTotalCents(270,1000),270);
  assert.equal(litixRetailPer1000Cents(2,example[0]),270);
  const q=boosteroQuote({service:example[0],quantity:1000});
  assert.equal(q.amountCents,270);
  assert.equal(q.pricingRule,"nearest");
  const ig={...example[0],service:11119,name:"Instagram Followers",
   category:"Instagram - USA Services"};
  assert.equal(litixRetailPer1000Cents(2,ig),900);
  const client={id:"curated_tiktok_followers_standard",platform:"TikTok",
   kind:"followers",min:100,max:10000,unitStep:1,per1000:2.7,pricingRule:"nearest"};
  assert.equal(quoteCentsForQuantity(client,1000),q.amountCents);
  const product=curatedPublicProduct(example,"TikTok","followers");
  assert.ok(product);
  assert.equal(product.id,"curated_tiktok_followers_standard");
  assert.equal(product.quantityCards.find(x=>x.quantity===1000)?.totalCents,270);
  assert.equal(product.quantityCards.find(x=>x.quantity===100)?.available,false);
  for(const forbidden of ["boosteroServiceId","supplierServiceId","wholesaleRate","supplierCost","markup","margin"])
   assert.ok(!JSON.stringify(product).includes(forbidden),"supplier data leak: "+forbidden);
 }finally{
  if(previous===undefined)delete process.env.LITIX_CURATED_TIKTOK_35_ENABLED;
  else process.env.LITIX_CURATED_TIKTOK_35_ENABLED=previous;
 }
});

test("selector routes opaque IDs through existing payment handler and refuses fake auto likes",async()=>{
 const [home,selector,api,readiness,price,retired]=await Promise.all([
  source("../app/page.jsx"),source("../components/CuratedFastCheckout.jsx"),
  source("../app/api/checkout/v1/route.js"),
  source("../app/api/checkout/readiness/route.js"),
  source("../lib/boosteroFulfillment.mjs"),
  source("../lib/retiredAutolikes.mjs")
 ]);
 assert.match(home,/NEXT_PUBLIC_LITIX_CURATED_STOREFRONT_ENABLED/);
 assert.match(home,/CuratedFastCheckout/);
 assert.match(home,/checkoutRoute==="curated"/);
 assert.match(home,/LitixCheckoutSelector selected=\{selected\}/);
 assert.match(selector,/Choose Platform/);
 assert.match(selector,/Choose Service/);
 assert.match(selector,/Custom amount/);
 assert.match(selector,/FEATURED/);
 assert.ok(selector.includes('href="/services"'));
 assert.match(api,/parseCuratedId/);
 assert.match(api,/resolveCuratedSupplier/);
 assert.match(api,/handleBoosteroOrder/);
 assert.match(api,/boosteroDestination/);
 assert.match(readiness,/verifyBoosteroQuote/);
 assert.match(readiness,/parseCuratedId/);
 assert.match(price,/pricingRule==="nearest"/);
 assert.ok(retired.includes("auto"));
 assert.doesNotMatch(selector,/30-Day Refill Protection|Starts in minutes/);
});
