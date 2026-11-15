import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {normalizeTikTokSupplierName,tiktokSkuForService,resolveExactTikTokServices} from "../lib/tiktokCatalog.mjs";
import {curatedPublicProduct,resolveCuratedSupplier} from "../lib/curatedCatalog.mjs";
import {boosteroQuote} from "../lib/boosteroFulfillment.mjs";

const item=(service,name,kind,rate="2.50",min="100")=>({
 service,name,category:"TikTok - "+kind,type:"Default",rate,min,max:"10000",refill:false
});
const liveNames=[
 item("5464","🙋‍♂️ NEW TikTok Followers ➡️ [ High Quality | 10K/Day | 30 Days Manual Refill ]","Followers","2.00"),
 item("5271","👍 NEW TikTok Likes ➡️ [ Real Accounts | 5K/Day | Non Drop  ] - Boostero’s Top Pick 🔥","Likes","2.00"),
 item("5259","💬 TikTok Random Comments ➡️ [ Real Accounts | 500/Day | Non Drop ] - Boostero’s Top Pick 🔥","Comments","9.00"),
 item("4005","👁 TikTok Views ➡️ [ Premium Quality | 100K/Day | 30 Days Manual Refill ]","Views","1.00"),
 item("5258","🙋‍♂️ TikTok Followers ➡️ [ High Quality | 100/Day | 30 Days Manual Refill ]","Followers","4.00"),
 item("1424","🙋‍♂️ TikTok Followers ➡️ [ Real Accounts | 3K/Day | Non Drop ] - Boostero’s Top Pick 🔥","Followers","3.00"),
 item("5466","😀 NEW TikTok Emoji Comments ➡️ [ High Quality | 5K/Day | Non Drop ]","Comments","2.00"),
 item("1636","🇧🇷 TikTok Brazil Followers ➡️ [ High Quality | 10K/Day ]","Followers","2.00"),
 item("3000","👍 TikTok Auto Likes ➡️ [ Real Accounts | 5K/Day ]","Likes","1.00")
];

test("normalize real supplier emoji/arrow catalog names to canonical match strings",()=>{
 assert.equal(normalizeTikTokSupplierName(liveNames[0].name),
  "NEW TikTok Followers [ High Quality | 10K/Day | 30 Days Manual Refill ]");
 assert.equal(normalizeTikTokSupplierName(liveNames[1].name).startsWith("NEW TikTok Likes ["),true);
 assert.equal(normalizeTikTokSupplierName(liveNames[2].name).startsWith("TikTok Random Comments ["),true);
 assert.equal(normalizeTikTokSupplierName(liveNames[6].name).startsWith("NEW TikTok Emoji Comments ["),true);
 assert.equal(tiktokSkuForService(liveNames[0]),"tiktok_followers");
 assert.equal(tiktokSkuForService(liveNames[1]),"tiktok_likes");
 assert.equal(tiktokSkuForService(liveNames[2]),"tiktok_comments");
 assert.equal(tiktokSkuForService(liveNames[3]),"tiktok_views");
 assert.equal(tiktokSkuForService(liveNames[6]),null,"Never sell emoji comments as standard comments");
 assert.equal(tiktokSkuForService(liveNames[7]),null,"Never substitute a country product");
 assert.equal(tiktokSkuForService(liveNames[8]),null,"Never offer retired AutoLikes as a regular Likes service");
});
test("all four core TikTok choices resolve live supplier IDs server-only, with independent quote",()=>{
 const exact=resolveExactTikTokServices(liveNames);
 for(const [kind,id] of [["followers","5464"],["likes","5271"],["comments","5259"],["views","4005"]]){
  const row=resolveCuratedSupplier(liveNames,"TikTok",kind,"standard");
  assert.equal(String(row?.service),id,kind);
  const preview=curatedPublicProduct(liveNames,"TikTok",kind,"standard");
  assert.equal(preview?.id,"curated_tiktok_"+kind+"_standard");
  assert.equal(preview?.purchasable,true);
  assert.equal(preview?.quantityCards.find(x=>x.quantity===1000)?.available,true);
  const real=boosteroQuote({service:row,quantity:1000});
  assert.equal(preview.quantityCards.find(x=>x.quantity===1000).totalCents,real.amountCents);
  assert.ok(!JSON.stringify(preview).includes('"service":'+id));
  for(const secret of ["wholesaleRate","supplierCost","boosteroServiceId","markup"])
   assert.ok(!JSON.stringify(preview).includes(secret));
 }
 assert.equal(exact.tiktok_followers.service,"5464");
 assert.equal(exact.tiktok_likes.service,"5271");
 assert.equal(exact.tiktok_comments.service,"5259");
});
test("exact missing still falls back to named live eligible, not an unsupported supplier type",()=>{
 const only=[liveNames[5],liveNames[6],liveNames[7],liveNames[8]];
 const fallback=resolveCuratedSupplier(only,"TikTok","followers","standard");
 assert.equal(fallback?.service,"1424");
 assert.equal(resolveCuratedSupplier(only,"TikTok","likes","standard"),null);
 assert.equal(resolveCuratedSupplier(only,"TikTok","comments","standard"),null);
});
test("payment routes resolve live IDs independently without ever trusting the browser's guessed supplier ID",async()=>{
 const [readiness,checkout]=await Promise.all([
  readFile(new URL("../app/api/checkout/readiness/route.js",import.meta.url),"utf8"),
  readFile(new URL("../app/api/checkout/v1/route.js",import.meta.url),"utf8")
 ]);
 assert.match(readiness,/resolveCuratedSupplier/);
 assert.match(readiness,/boosteroQuote/);
 assert.match(checkout,/resolveCuratedSupplier/);
 assert.match(checkout,/handleBoosteroOrder/);
});
