import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {instagramUsername,canonicalPostURL,normalizePosts,isInstagramLikes,quoteSelectedPosts,MAX_POSTS,statusOfItems} from "../lib/choosePosts.mjs";

const post=n=>"https://www.instagram.com/p/POST_ID_"+n+"/";
const service={service:"33630",name:"Instagram Likes · Regular",category:"Instagram Likes",
 type:"Default",min:100,max:100000,step:100,pricedRetail:5,rate:0.1};
test("username parsing is strict, ignores hostile URL hosts and blocks post URLs",()=>{
 assert.equal(instagramUsername("@Creator.Name"),"Creator.Name");
 assert.equal(instagramUsername("https://www.instagram.com/Creator.Name/"),"Creator.Name");
 for(const name of ["https://www.instagram.com.evil.org/john/","https://instagram.com/p/POST_12345/","john/../admin","@a b","https://instagram.com/a?private=1"])assert.equal(instagramUsername(name),null);
});
test("canonical URLs accept supported post types, strip tracking query, reject impostor domains",()=>{
 assert.equal(canonicalPostURL("https://instagram.com/p/ABC123_45/?igsh=foo"),"https://www.instagram.com/p/ABC123_45/");
 assert.equal(canonicalPostURL("https://www.instagram.com/reel/XyZaa55/"),"https://www.instagram.com/reel/XyZaa55/");
 for(const bad of ["https://instagram.com.evil.org/p/ABC123/","http://www.instagram.com/p/ABC123/","https://www.instagram.com/username/","https://www.instagram.com/stories/XYZ/","https://evil.com/p/ABC123/"])assert.equal(canonicalPostURL(bad),null);
});
test("deduplicate canonical posts and cap post count",()=>{
 assert.deepEqual(normalizePosts([post("112233")]),[post("112233")]);
 assert.throws(()=>normalizePosts([post("112233"),post("112233")+"?igsh=1"]),/duplicate/);
 assert.throws(()=>normalizePosts(Array.from({length:MAX_POSTS+1},(_,i)=>post("abc"+i))),/between/);
});
test("no follower, AutoLikes, subscription, or story service in picker",()=>{
 assert.equal(isInstagramLikes(service),true);
 for(const name of ["Instagram Followers","Instagram AutoLikes","Instagram Story Likes Subscription","TikTok Likes"])assert.equal(isInstagramLikes({...service,name,category:name}),false);
});
test("exact cents calculation uses existing rate per 1k with $5 cart threshold",()=>{
 let quote=quoteSelectedPosts({service,quantityEach:500,postURLs:[post("112233"),post("223344")]});
 assert.equal(quote.eachCents,250);assert.equal(quote.totalCents,500);
 assert.equal(quote.supplierCostCents,10);
 assert.throws(()=>quoteSelectedPosts({service,quantityEach:100,postURLs:[post("112233")]}),/Minimum \$5/);
 assert.throws(()=>quoteSelectedPosts({service,quantityEach:550,postURLs:[post("112233"),post("223344")]}),/step/);
 assert.throws(()=>quoteSelectedPosts({service:{...service,rate:2},quantityEach:500,postURLs:[post("112233"),post("223344")]}),/cost protection/);
});
test("independent fulfillment status indicates a partial supplier failure",()=>{
 assert.equal(statusOfItems([{state:"SUBMITTED"},{state:"RETRYABLE"}]),"manual_review");
 assert.equal(statusOfItems([{state:"SUBMITTED"},{state:"SUBMITTED"}]),"submitted");
});
test("new feature does not modify original gateway, bundles, AI or AutoLikes files",()=>{
 const legacy=readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8");
 const route=readFileSync(new URL("../app/api/choose-posts/checkout/route.js",import.meta.url),"utf8");
 assert.match(legacy,/payment_token:token/);
 assert.match(route,/on conflict\(idempotency_key\) do nothing/);
 assert.match(route,/payment_state='paid'/);
 assert.match(route,/after\(async\(\)=>/);
 assert.match(route,/payment_state='review'/);
 assert.match(route,/previewDemo\(\)&&x\?\.simulate===true/);
 assert.doesNotMatch(route,/STRIPE_SECRET_KEY|BLUEVINE|AUTO_LIKES/);
});
test("mock route rejects unpaid or unsafe requests without gateway or supplier calls",async()=>{
 const source=readFileSync(new URL("../app/api/choose-posts/checkout/route.js",import.meta.url),"utf8")
  .replace('import {after} from "next/server";','const after=fn=>globalThis.__postsAfter.push(fn);')
  .replace('import {randomUUID} from "node:crypto";','import {randomUUID} from "node:crypto";')
  .replace('"../../../../lib/choosePosts.mjs"',JSON.stringify(new URL("../lib/choosePosts.mjs",import.meta.url).href))
  .replace('import {chooseSql,chooseDatabaseReady,sha,choiceId,privateToken,previewDemo,getPreviewService,getCurrentLikesService,notifyPaid,dispatchPaidPosts} from "../../../../lib/choosePostsServer.mjs";',
   'const {chooseSql,chooseDatabaseReady,sha,choiceId,privateToken,previewDemo,getPreviewService,getCurrentLikesService,notifyPaid,dispatchPaidPosts}=globalThis.__postsHarness;');
 globalThis.__postsAfter=[];
 globalThis.__postsHarness={
  chooseSql:()=>({query:async q=>q.startsWith("with parent")?[{total:2}]:[]}),
  chooseDatabaseReady:()=>true,sha:()=>("a".repeat(64)),choiceId:()=> "ltx2_11111111-1111-4111-8111-111111111111",
  privateToken:()=> "11111111-1111-4111-8111-111111111111-22222222",
  previewDemo:()=>true,getPreviewService:async()=>service,getCurrentLikesService:async()=>service,
  notifyPaid:async()=>{},dispatchPaidPosts:async()=>{}
 };
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV="preview";
 const oldFetch=globalThis.fetch;let network=0;globalThis.fetch=async()=>{network++;throw Error("Unexpected external request")};
 try{
  const api=await import("data:text/javascript,"+encodeURIComponent(source));
  const input={username:"john",email:"customer@example.com",serviceId:"33630",posts:[post("112233"),post("223344")],
   quantityEach:500,expectedAmountCents:500,idempotencyKey:"11111111-1111-4111-8111-111111111111",simulate:true};
  const call=x=>api.POST(new Request("https://preview.example.com/api/choose-posts/checkout",{method:"POST",
   headers:{"content-type":"application/json","origin":"https://preview.example.com"},body:JSON.stringify(x)}));
  const demo=await call(input);const result=await demo.json();
  assert.equal(demo.status,200);assert.equal(result.payment,"simulated");assert.equal(network,0);assert.equal(globalThis.__postsAfter.length,0);
  const bad=await call({...input,posts:[post("112233"),post("112233")]});assert.equal(bad.status,422);
  const changed=await call({...input,expectedAmountCents:999});assert.equal(changed.status,409);
  const origin=await api.POST(new Request("https://preview.example.com/api/choose-posts/checkout",{method:"POST",headers:{"origin":"https://evil.org","content-type":"application/json"},body:JSON.stringify(input)}));assert.equal(origin.status,403);
  assert.equal(network,0);
 }finally{globalThis.fetch=oldFetch;process.env.VERCEL_ENV=old;delete globalThis.__postsHarness;delete globalThis.__postsAfter;}
});
