import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {STATIC_CURATED_PREVIEW} from "../lib/curatedStaticPreview.mjs";
import {quoteCuratedCart,publicCartQuote} from "../lib/litixCartQuote.mjs";
import {litixCartTrackingToken} from "../lib/litixCartTrackingToken.mjs";
import {orderProofCSV} from "../app/api/admin/orders/proof/route.js";
import {cartBumpKind,CART_BUMP_QTY} from "../lib/cartBumpConfig.mjs";

const source=path=>readFile(new URL(path,import.meta.url),"utf8");
const row=(id,name,rate,platform="Instagram")=>({
 service:String(id),name,category:platform+" - Services",
 type:"Default",min:"100",max:"10000",rate:String(rate)
});
const supplier=[
 row(20011,"Instagram Followers [ High Quality | 5K/Day ]",5),
 row(20012,"Instagram Likes [ High Quality | 5K/Day ]",1),
 row(20013,"Instagram Views [ High Quality | 100K/Day ]",2),
 row(20014,"TikTok Followers [ High Quality | 5K/Day ]",5,"TikTok"),
 row(20015,"TikTok Likes [ High Quality | 5K/Day ]",1,"TikTok")
];
const api=async action=>{
 assert.equal(action,"services");
 return supplier;
};
test("first render has all eight service buttons and six quantity cards with no price-authorized fallback",async()=>{
 assert.equal(STATIC_CURATED_PREVIEW.length,8);
 assert.deepEqual(new Set(STATIC_CURATED_PREVIEW.map(x=>x.platform)),new Set(["Instagram","TikTok"]));
 for(const product of STATIC_CURATED_PREVIEW){
  assert.equal(product.quantityCards.length,6);
  assert.equal(product.preview,true);
  assert.equal(product.purchasable,false);
  assert.match(product.id,/^curated_/);
  assert.ok(product.quantityCards.some(x=>x.quantity===1000));
 }
 const home=await source("../app/page.jsx");
 const selector=await source("../components/CuratedFastCheckout.jsx");
 assert.doesNotMatch(home,/Preparing the focused checkout/);
 assert.match(home,/CURATED_HOME_ENABLED\?"curated":"catalog"/);
 assert.match(home,/useState\(CURATED_HOME_ENABLED\?null:INITIAL_FAST_SERVICE\)/);
 assert.match(selector,/useState\(STATIC_CURATED_PREVIEW\)/);
 assert.match(selector,/useState\("preview"\)/);
});
test("cart bump is priced at live retail, never an invented $1.99/40% discount",async()=>{
 const previous=process.env.LITIX_CART_BUMPS_ENABLED;
 try{
  process.env.LITIX_CART_BUMPS_ENABLED="true";
  const cart=await quoteCuratedCart({
   serviceId:"curated_instagram_followers_standard",quantity:1000,
   includeBump:true,mainTarget:"https://www.instagram.com/creator/",
   bumpTarget:"https://www.instagram.com/p/ABC123456/",
   operation:api
  });
  assert.equal(cart.main.quote.kind,"followers");
  assert.equal(cart.bump.kind,"likes");
  assert.equal(cart.bump.quantity,CART_BUMP_QTY.likes);
  assert.equal(cart.main.destination,"https://www.instagram.com/creator/");
  assert.equal(cart.bump.destination,"https://www.instagram.com/p/ABC123456/");
  assert.ok(cart.totalCents>=cart.main.quote.amountCents+100);
  const dto=publicCartQuote(cart);
  assert.equal(dto.totalCents,cart.main.quote.amountCents+cart.bump.quote.amountCents);
  for(const key of ["supplierServiceId","boosteroServiceId","supplierCost","wholesaleRate","markup"])
   assert.ok(!JSON.stringify(dto).includes(key));
  assert.equal(cartBumpKind("likes"),"views");
  assert.equal(cartBumpKind("comments"),null);
  const likes=await quoteCuratedCart({
   serviceId:"curated_instagram_likes_standard",quantity:1000,
   includeBump:true,mainTarget:"https://www.instagram.com/p/ABC123456/",
   operation:api
  });
  assert.equal(likes.bump.kind,"views");
  assert.equal(likes.bump.destination,likes.main.destination);
  assert.equal(likes.bump.quantity,1000);
  await assert.rejects(()=>quoteCuratedCart({
   serviceId:"curated_instagram_followers_standard",quantity:1000,
   includeBump:true,mainTarget:"https://www.instagram.com/creator/",
   bumpTarget:"https://www.instagram.com/otherprofile/",
   operation:api
  }),/invalid_bump_destination/);
 }finally{
  if(previous===undefined)delete process.env.LITIX_CART_BUMPS_ENABLED;
  else process.env.LITIX_CART_BUMPS_ENABLED=previous;
 }
});
test("HMAC tracking token is durable without storing a plaintext token",()=>{
 const old=process.env.LITIX_TRACK_SIGNING_SECRET;
 const id="ltx2_aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa";
 try{
  process.env.LITIX_TRACK_SIGNING_SECRET="this-is-a-long-random-test-key-with-more-than-32-bytes";
  const a=litixCartTrackingToken(id),b=litixCartTrackingToken(id);
  assert.equal(a,b);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.equal(createHash("sha256").update(a).digest("hex").length,64);
  assert.notEqual(a,litixCartTrackingToken("ltx2_bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"));
 }finally{
  if(old===undefined)delete process.env.LITIX_TRACK_SIGNING_SECRET;
  else process.env.LITIX_TRACK_SIGNING_SECRET=old;
 }
});
test("payment route uses one sale and two durable supplier claims; proof export prevents CSV formula injection",async()=>{
 const [checkout,engine,migration,track,invoice]=await Promise.all([
  source("../app/api/checkout/v1/route.js"),
  source("../lib/litixCartCheckout.mjs"),
  source("../db/migrations/20261114_litix_cart_bump_order_proof.sql"),
  source("../app/api/internal/boostero/track/route.js"),
  source("../lib/litixCartReceipts.mjs")
 ]);
 assert.match(checkout,/data\?\.bump\?\.enabled===true/);
 assert.match(engine,/payment_transaction_id=\$2/);
 assert.match(engine,/payment_state='paid'/);
 assert.match(engine,/new URLSearchParams\(\{security_key:/);
 assert.match(engine,/state='DISPATCHING'/);
 assert.match(engine,/state='QUEUED'/);
 assert.match(engine,/supplierAttempted\?"UNKNOWN_OUTCOME":"MANUAL_REVIEW"/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.litix_cart_lines/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.litix_order_proof_events/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.litix_cart_receipts/);
 assert.match(invoice,/sendPendingCartReceipts/);
 assert.match(track,/cartItems/);
 const csv=orderProofCSV({
  order:{id:"order",email:"=IMPORTXML(A1,A2)",amount_cents:100,payment_state:"paid"},
  proof:{buyer_ip:"127.0.0.1",user_agent:"test"},lines:[],events:[]
 });
 assert.match(csv,/'=IMPORTXML/);
 assert.doesNotMatch(csv,/Boostero's Top Pick/);
});
