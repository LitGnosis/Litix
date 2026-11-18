import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {curatedPublicProduct,resolveCuratedSupplier,parseCuratedId} from "../lib/curatedCatalog.mjs";
import {quoteCentsForQuantity,checkoutQuantityEligible,defaultCheckoutQuantity} from "../lib/litixCheckoutDisplay.mjs";
import {boosteroQuote} from "../lib/boosteroFulfillment.mjs";
import {curatedRetailQuote} from "../lib/curatedVolumePricing.mjs";

const row=(id,name,kind,rate="2.00",min=250)=>({
 service:id,name,category:"TikTok - "+kind,rate,
 type:"Default",min:String(min),max:"10000",refill:false
});
const live=[
 row(991101,"TikTok Followers [ Real Accounts | 2K/Day ]","Followers"),
 row(991102,"TikTok Likes [ Real Accounts | 5K/Day ]","Likes","8.00"),
 row(991103,"TikTok Random Comments [ Real Accounts | 500/Day ]","Comments","9.00",100),
 row(991104,"TikTok Likes [ Real Accounts | 5K/Day ]","Followers","8.00"),
 row(991105,"TikTok Followers Monthly Growth Package","Followers"),
 row(991106,"TikTok Auto Followers [ Real Accounts ]","Followers"),
 row(991107,"TikTok Views [ Real Accounts | 5K/Day ]","Views","1.50")
];
const file=path=>readFile(new URL(path,import.meta.url),"utf8");

test("TikTok exact-preferred service absent: live named Default service becomes a purchasable standard listing",()=>{
 for(const [kind,id] of [
  ["followers",991101],["likes",991102],["comments",991103],["views",991107]
 ]){
  const resolved=resolveCuratedSupplier(live,"TikTok",kind,"standard");
  assert.equal(resolved?.service,id,kind);
  assert.equal(resolveCuratedSupplier(live,"TikTok",kind,"vip"),null,
   "Do not duplicate the same supplier service as fake VIP");
  const publicProduct=curatedPublicProduct(live,"TikTok",kind,"standard");
  assert.equal(publicProduct?.id,"curated_tiktok_"+kind+"_standard");
  assert.equal(publicProduct?.purchasable,true);
  assert.equal(publicProduct?.tier,"standard");
  assert.equal(publicProduct?.quantityCards.length,7,
   "Live supplier maximum of 10,000 is displayed beyond the six base presets");
  assert.equal(publicProduct?.max,10000);
  assert.equal(publicProduct?.quantityCards.at(-1)?.quantity,10000);
  assert.equal(publicProduct?.quantityCards.at(-1)?.available,true);
  assert.equal(publicProduct?.quantityCards.find(x=>x.quantity===1000)?.available,true);
  const actual=curatedRetailQuote(boosteroQuote({service:resolved,quantity:1000}));
  assert.equal(publicProduct?.quantityCards.find(x=>x.quantity===1000)?.totalCents,actual.amountCents);
  assert.equal(quoteCentsForQuantity(publicProduct,1000),actual.amountCents);
  assert.ok(!JSON.stringify(publicProduct).includes(String(id)),"Supplier ID exposed in public payload");
  for(const internal of ["wholesaleRate","costUSD","boosteroServiceId","margin","markup"])
   assert.ok(!JSON.stringify(publicProduct).includes(internal));
 }
 assert.equal(parseCuratedId("curated_tiktok_followers_standard")?.kind,"followers");
});

test("no cross-kind auto, monthly, or non-Default supplier can be selected",()=>{
 const unsafe=[
  row(1,"TikTok Likes [ Real Accounts ]","Followers"),
  row(2,"TikTok Followers Monthly Growth Package","Followers"),
  row(3,"TikTok Auto Followers [ Real Accounts ]","Followers"),
  {...row(4,"TikTok Followers [ Real Accounts ]","Followers"),type:"Custom Comments"},
  {...row(5,"Instagram Followers [ High Quality ]","Followers"),category:"TikTok - Followers"}
 ];
 assert.equal(resolveCuratedSupplier(unsafe,"TikTok","followers","standard"),null);
 assert.equal(curatedPublicProduct(unsafe,"TikTok","followers","standard"),null);
});

test("a verified exact match keeps priority; a second distinct live active listing may be VIP",()=>{
 const exact=row(991100,"NEW TikTok Followers [ High Quality | 10K/Day | 30 Days Manual Refill ]","Followers","4.00",100);
 const preferred=resolveCuratedSupplier([exact,...live],"TikTok","followers","standard");
 const vip=resolveCuratedSupplier([exact,...live],"TikTok","followers","vip");
 assert.equal(preferred?.service,991100);
 assert.equal(vip?.service,991101);
});

test("quantity remains selected on refresh when legal, then clamps only if live minimum changes",async()=>{
 const [page,selector]=await Promise.all([
  file("../app/page.jsx"),file("../components/CuratedFastCheckout.jsx")
 ]);
 assert.match(page,/const sameService=Boolean\(service&&selected\?\.id===service\.id\)/);
 assert.match(page,/sameService&&checkoutQuantityEligible\(service,qty\)/);
 assert.match(page,/setSelected\(service\);setQty\(preferredQuantity\)/);
 assert.match(selector,/status==="ready"/);
 const selected=curatedPublicProduct(live,"TikTok","followers","standard");
 assert.equal(checkoutQuantityEligible(selected,250),true);
 assert.equal(checkoutQuantityEligible(selected,100),false);
 assert.equal(defaultCheckoutQuantity(selected),1000);
});
