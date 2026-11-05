import test from "node:test";
import assert from "node:assert/strict";
import {joySmmReadOnly,joySmmConnectionSummary,JOYSMM_ENDPOINT} from "../lib/joysmmReadOnly.mjs";
import {GET as healthGet,POST as healthPost} from "../app/api/internal/supplier-probe/route.js";

const key="J".repeat(48);
const services=[
 {service:101,name:"Instagram Likes future posts",category:"Recommended Services Instagram",type:"Subscriptions",rate:"4.25",min:"50",max:"1000",refill:false,cancel:false},
 {service:102,name:"TikTok Likes",category:"Recommended Services TikTok",type:"Default",rate:"2.30",min:"100",max:"5000",refill:true,cancel:false},
 {service:"n/a",name:"Invalid",type:"Default",rate:"bad",min:"0",max:"10"}
];
function fakeTransport(events){
 return async(url,options)=>{
  assert.equal(url,JOYSMM_ENDPOINT);
  assert.equal(options.method,"POST");assert.equal(options.redirect,"error");
  const body=options.body;
  const action=body.get("action");
  assert.equal(body.get("key"),key);
  events.push(action);
  if(action==="services")return {ok:true,json:async()=>services};
  if(action==="balance")return {ok:true,json:async()=>({balance:"10.50",currency:"USD"})};
  if(action==="status")return {ok:true,json:async()=>({status:"Completed",charge:"0.20",remains:"0"})};
  throw Error("MUTATION_REQUEST_SHOULD_NEVER_HAPPEN");
 };
}
test("JoySMM adapter forbids every mutating API operation",async()=>{
 for(const action of ["add","cancel","refill","refill_status","transfer","pay"]){
  await assert.rejects(joySmmReadOnly({action,key,transport:async()=>{throw Error("not allowed");}}),/joysmm_mutation_forbidden/);
 }
});
test("read-only catalog validates rows but never returns from public route",async()=>{
 const seen=[];
 const res=await joySmmReadOnly({action:"services",key,transport:fakeTransport(seen)});
 assert.equal(res.validCount,2);assert.equal(res.receivedCount,3);
 assert.equal(res.services[0].service,101);assert.equal(res.services[0].rate,4.25);
 assert.deepEqual(seen,["services"]);
});
test("read-only connection checks service shape and USD funded wallet",async()=>{
 const seen=[];
 const x=await joySmmConnectionSummary({key,transport:fakeTransport(seen)});
 assert.equal(x.connected,true);
 assert.equal(x.readOnly,true);
 assert.equal(x.paidDispatchEnabled,false);
 assert.equal(x.catalogServiceCount,2);
 assert.equal(x.recommendedServiceCount,2);
 assert.equal(x.futurePostSubscriptionCandidates,1);
 assert.deepEqual(x.subscriptionPlatforms,["instagram"]);
 assert.equal(x.walletFunded,true);
 assert.equal(x.walletCurrency,"USD");
 assert.deepEqual(seen,["services","balance"]);
});
test("JoySMM status only for account-owned, confirmed numeric supplier IDs",async()=>{
 const seen=[];
 const a=await joySmmReadOnly({action:"status",key,orderIds:["12345"],ownedOrderIds:["12345"],transport:fakeTransport(seen)});
 assert.equal(a.orders[0].status,"Completed");
 assert.equal(a.orders[0].remains,0);
 assert.deepEqual(seen,["status"]);
 await assert.rejects(joySmmReadOnly({action:"status",key,orderIds:["12345"],ownedOrderIds:[],transport:fakeTransport([])}),/joysmm_order_not_owned/);
});
test("API errors do not leak credentials or private raw responses",async()=>{
 const transport=async()=>({ok:true,json:async()=>({error:"invalid API key "+key})});
 await assert.rejects(joySmmReadOnly({action:"balance",key,transport}),err=>{
  assert.doesNotMatch(err.message,new RegExp(key));
  assert.equal(err.message,"joysmm_api_response_rejected");return true;
 });
});
test("no credential fails closed; invalid service list rejected",async()=>{
 await assert.rejects(joySmmReadOnly({action:"services",key:"short"}),/unconfigured/);
 await assert.rejects(joySmmReadOnly({action:"services",key,transport:async()=>({ok:true,json:async()=>({wrong:true})})}),/catalog_shape_invalid/);
});
test("public health endpoint in preview cannot contact supplier, POST forbidden",async()=>{
 const prior=process.env.VERCEL_ENV;
 process.env.VERCEL_ENV="preview";
 try{
  const r=await healthGet();
  assert.equal(r.status,200);
  const d=await r.json();
  assert.equal(d.status,"PREVIEW_ONLY");
  assert.equal(d.checkoutRerouted,false);
  assert.equal((await healthPost()).status,405);
 }finally{if(prior===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=prior;}
});
