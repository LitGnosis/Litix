import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateReview,reviewFingerprint,reviewTokenHash,reviewAdmin,submitReview} from "../lib/premiumReviews.mjs";
const sample={displayName:"A Customer",serviceCategory:"Instagram Followers",rating:5,
 reviewText:"The ordering process was easy to follow and tracking was accessible."};
test("review validation rejects injection-sized and fraudulent metadata",()=>{
 assert.deepEqual(validateReview(sample),{...sample,imageUrl:null});
 for(const bad of [{...sample,displayName:""},{...sample,rating:6},{...sample,reviewText:"too short"},
  {...sample,companyWebsite:"bot.example"},{...sample,imageUrl:"http://not-allowed.example/image.jpg"}]){
  assert.throws(()=>validateReview(bad));
 }
});
test("HMAC fingerprint is deterministic without revealing IP; owner bearer uses exact constant-time match",()=>{
 const secret="a".repeat(64);
 assert.equal(reviewFingerprint("203.0.113.1","Browser",secret).length,64);
 assert.notEqual(reviewFingerprint("203.0.113.1","Browser",secret),reviewFingerprint("203.0.113.2","Browser",secret));
 assert.equal(reviewAdmin("Bearer "+"b".repeat(64),"b".repeat(64)),true);
 assert.equal(reviewAdmin("Bearer "+"c".repeat(64),"b".repeat(64)),false);
 assert.equal(reviewAdmin("Bearer short","short"),false);
 assert.equal(reviewTokenHash("secret"),"2bb80d537b1da3e38bd30361aa855686bde0ba0b");
});
test("reviews default to pending; verified-purchase badge requires matching private token + completed paid order",async()=>{
 const old=process.env.LITIX_REVIEWS_HMAC_KEY;process.env.LITIX_REVIEWS_HMAC_KEY="a".repeat(64);
 const calls=[];
 const sql={query:async(q,params=[])=>{
  calls.push({q,params});
  if(q.startsWith("select id,category,payment_state"))return [{id:"ltx2_00000000-0000-4000-8000-000000000001",
    category:"Instagram Followers",payment_state:"paid",fulfillment_state:"completed"}];
  return [];
 }};
 try{
  const x=await submitReview({...sample,orderId:"ltx2_00000000-0000-4000-8000-000000000001",
   trackingToken:"my-private-token-with-adequate-length"}, {sql,ip:"203.0.113.22",ua:"Test Browser"});
  assert.equal(x.submitted,true);assert.equal(x.status,"pending");assert.equal(x.verifiedPurchase,true);
  const insert=calls.find(c=>c.q.startsWith("insert into"));
  assert.equal(insert.params[7],true);assert.equal(insert.params.length,9);
  assert.ok(!JSON.stringify(insert).includes("my-private-token-with-adequate-length"));
  assert.match(insert.q,/'pending'/);
 }finally{old===undefined?delete process.env.LITIX_REVIEWS_HMAC_KEY:process.env.LITIX_REVIEWS_HMAC_KEY=old}
});
test("review endpoints require moderation before publication and no admin token exposed",()=>{
 const api=readFileSync(new URL("../app/api/premium/reviews/route.js",import.meta.url),"utf8");
 const admin=readFileSync(new URL("../app/api/internal/premium/reviews/route.js",import.meta.url),"utf8");
 assert.match(api,/where status='approved'/);
 assert.match(api,/if\(!origin\|\|origin!==new URL\(req.url\)\.origin\)/);
 assert.match(admin,/reviewAdmin\(req.headers.get\("authorization"\)\)/);
 assert.match(admin,/status='pending'/);
});
