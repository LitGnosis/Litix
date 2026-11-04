import test from "node:test";
import assert from "node:assert/strict";
import {
 eligibleFuturePostLikes,buildFuturePostSubscription,createReadOnlySubscriptionSupplierClient
} from "../lib/litixSubscriptionSupplierEvaluation.mjs";
const base={service:"1081",name:"Instagram Auto Likes for New Posts",category:"Instagram Likes",type:"Subscriptions",rate:"0.21",min:"50",max:"10000"};
test("rejects generic API examples and one-time likes, preserves verified subscription candidates",()=>{
 const rows=eligibleFuturePostLikes([
  {...base,type:"Default"}, {...base,service:"1082",name:"Instagram Followers"},
  base,{...base,service:"1083",name:"TikTok Auto Likes",category:"TikTok"},
  {...base,service:"bad",type:"Subscriptions"},{...base,service:"1084",rate:"0"},
 ]);
 assert.deepEqual(rows.map(x=>x.id),[1081,1083]);
 assert.equal(rows[0].type,"Subscriptions");
});
test("subscription fields cover ONLY future posts with fixed delivery amount",()=>{
 const [s]=eligibleFuturePostLikes([base]);
 const request=buildFuturePostSubscription({service:s,username:"@example_user",likesPerPost:100,postCount:10,now:new Date("2026-11-04T00:00:00Z")});
 assert.deepEqual(request,{action:"add",service:1081,username:"example_user",min:100,max:100,posts:10,old_posts:0,delay:0,expiry:"04/12/2026"});
 assert.throws(()=>buildFuturePostSubscription({service:{...s,type:"Default"},username:"account",likesPerPost:100,postCount:10}));
 assert.throws(()=>buildFuturePostSubscription({service:s,username:"@private/path",likesPerPost:100,postCount:10}));
});
test("unverified integration client cannot create orders or charge any supplier",async()=>{
 const requests=[];
 const mock=async (_url,opts)=>{requests.push(Object.fromEntries(opts.body));return {ok:true,json:async()=>[base]};};
 const c=createReadOnlySubscriptionSupplierClient({provider:"joysmm",key:"test_long_private_key",fetcher:mock});
 const found=await c.listEligibleServices();
 assert.equal(found.length,1);
 assert.deepEqual(requests.map(x=>x.action),["services"]);
 assert.equal(requests.some(x=>x.action==="add"),false);
 const source=await import("../lib/litixAutoLikesSalesGate.mjs");
 assert.equal(source.autolikesNewSalesEnabled(),false);
});
