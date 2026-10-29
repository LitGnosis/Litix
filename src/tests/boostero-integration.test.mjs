import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {boosteroCompatibleServices} from "../lib/boosteroReadOnly.mjs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("legacy numeric order requests cannot reach a PayKings or supplier API",async()=>{
 // Execute the actual App Router route with only its imported handler replaced.
 // This prevents Next's server-only module from loading under plain Node tests.
 let handlerCalls=0;
 const route=source("app/api/checkout/v1/route.js")
  .replace('import {handleBoosteroOrder} from "../../../../lib/boosteroOrderHandler.mjs";',
    'const handleBoosteroOrder=async()=>{handlerCalls++;return Response.json({error:"not available"},{status:503})};');
 const {POST}=await import("data:text/javascript;base64,"+Buffer.from(route).toString("base64"));
 const existing=globalThis.fetch;
 let outbound=0;
 globalThis.fetch=async()=>{outbound++;throw Error("external payment/supplier attempt")};
 try{
  for(const id of ["1","33442","5461","0","smmglob_33442","../other"]){
   const result=await POST(new Request("https://www.litix.net/api/checkout/v1",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({serviceId:id,quantity:1000,paymentToken:"never-a-real-payment-token"})
   }));
   assert.equal(result.status,409,id);
   assert.match((await result.json()).error,/verified Boostero/i);
  }
  assert.equal(outbound,0);
  assert.equal(handlerCalls,0,"Unapproved IDs cannot reach PayKings checkout");
 }finally{globalThis.fetch=existing}
});

test("real checkout only accepts explicitly namespaced Boostero services and preserves handler",()=>{
 const route=source("app/api/checkout/v1/route.js");
 assert.match(route,/handleBoosteroOrder/);
 assert.match(route,/\^boostero_\[0-9\]/);
 assert.match(route,/No charge attempted/);
 assert.doesNotMatch(route,/smmglob\.com|smmfollowom/i);
 const paid=source("lib/boosteroOrderHandler.mjs");
 assert.match(paid,/verifyBoosteroQuote/);
 assert.match(paid,/paymentTransaction|payment_state|payment_attempted_at/i);
 assert.match(paid,/idempotencyKey/);
});

test("only compatible Boostero social services reach the four-card verifier",()=>{
 const items=[
  {service:101,name:"Instagram Followers",category:"Instagram Followers",type:"Default",rate:"3",min:100,max:10000},
  {service:102,name:"Instagram Likes",category:"Instagram Likes",type:"Default",rate:"2",min:100,max:10000},
  {service:103,name:"TikTok Followers",category:"TikTok Followers",type:"Default",rate:"3",min:100,max:10000},
  {service:104,name:"TikTok Likes",category:"TikTok Likes",type:"Default",rate:"2",min:100,max:10000},
  {service:105,name:"Instagram Auto Likes",category:"Instagram Likes",type:"Subscriptions",rate:"2",min:100,max:10000},
  {service:106,name:"YouTube Views",category:"YouTube Views",type:"Default",rate:"1",min:100,max:10000},
  {service:107,name:"Instagram Premium Followers",category:"Instagram Followers",type:"Package",rate:"10",min:1,max:1},
 ];
 assert.deepEqual(boosteroCompatibleServices(items).map(x=>x.id),["101","102","103","104"]);
});

test("historical orders remain trackable without any retired-supplier fallback",()=>{
 const track=source("app/api/track/route.js");
 const catalog=source("app/api/catalog/v1/route.js");
 assert.match(track,/boosteroTracking/);
 assert.match(track,/smmTracking/); // historical database lookup only
 assert.match(catalog,/enabledBoosteroCards/);
 assert.match(catalog,/buildActiveStorefrontCatalog/);
 assert.doesNotMatch(catalog,/smmglob|smmfollowom/i);
});
