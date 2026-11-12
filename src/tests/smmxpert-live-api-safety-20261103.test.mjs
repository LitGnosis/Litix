import test from "node:test";
import assert from "node:assert/strict";
import {smmxpertConnectionCheck,smmxpertReadStatus,smmxpertAddClaimedOrder,SMMXPERT_API_URL}
 from "../lib/smmxpertLiveApi.mjs";
const KEY="not-a-real-supplier-test-key-abc123";
const vendorCall=(onCall)=>{
 const calls=[];
 return {calls,fetchImpl:async(url,opts)=>{
   assert.equal(url,SMMXPERT_API_URL);
   assert.equal(opts.method,"POST");
   assert.equal(opts.redirect,"error");
   const body=new URLSearchParams(opts.body);
   calls.push({action:body.get("action"),service:body.get("service"),
    quantity:body.get("quantity"),orders:body.get("orders")});
   const data=await onCall(body);
   return {ok:true,status:200,json:async()=>data};
 }};
};
test("actual services and account currency are independently checked (no orders)",async()=>{
 const fake=vendorCall(form=>form.get("action")==="services"?[
  {service:3301,name:"Instagram Likes",type:"Default",rate:"2.5",min:100,max:10000},
  {service:0,rate:"bad"}
 ]:{balance:"123.00",currency:"INR"});
 const s=await smmxpertConnectionCheck({fetchImpl:fake.fetchImpl,key:KEY});
 assert.equal(s.authenticated,true);
 assert.equal(s.validServices,1);
 assert.equal(s.accountCurrency,"INR");
 assert.equal(s.rateCurrencyVerified,false);
 assert.deepEqual(fake.calls.map(x=>x.action),["services","balance"]);
 assert.ok(!JSON.stringify(s).includes(KEY));
 assert.ok(!JSON.stringify(s).includes("123.00"),"wallet amount must not be exposed");
});
test("supplier 401 access failure is sanitized",async()=>{
 const fake=async()=>({ok:false,status:401,json:async()=>({error:KEY})});
 await assert.rejects(()=>smmxpertConnectionCheck({fetchImpl:fake,key:KEY}),
  /smmxpert_access_denied/);
});
test("read-only status checks cannot use legacy Boostero IDs",async()=>{
 const fake=vendorCall(form=>form.get("orders")?{
  11:{status:"Completed",remains:"0",charge:"1.23"},
  12:{status:"Canceled",remains:"50",charge:"0.23"}
 }:{status:"Pending",remains:"3",charge:"0.20",currency:"USD"});
 await assert.rejects(()=>smmxpertReadStatus(["11"],{ownedSupplierIds:["12977366"],
  fetchImpl:fake.fetchImpl,key:KEY}),/order_not_owned/);
 assert.equal(fake.calls.length,0);
 const status=await smmxpertReadStatus(["11","12"],{ownedSupplierIds:["11","12"],fetchImpl:fake.fetchImpl,key:KEY});
 assert.deepEqual(status.map(s=>s.state),["Completed","Canceled"]);
 assert.equal(status[0].remains,0);
 assert.equal(fake.calls.length,1);
 assert.equal(fake.calls[0].action,"status");
});
test("live add cannot run without production flag and verified paid single-use claim",async()=>{
 const fake=vendorCall(()=>({order:98765}));
 delete process.env.LITIX_SMMXPERT_LIVE_ENABLED;
 await assert.rejects(()=>smmxpertAddClaimedOrder({
  serviceId:3301,link:"https://www.instagram.com/p/abc123/",quantity:100,
  claim:{verifiedPaid:true,oneWayDbClaim:true,orderId:"ltx2_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
   matchingQuoteApproved:true,approvedServiceIds:["3301"]}
 },{fetchImpl:fake.fetchImpl,key:KEY}),/live_dispatch_disabled/);
 assert.equal(fake.calls.length,0,"supplier must not be contacted");
});
test("successful add requires explicit production feature flag and claimed order",async()=>{
 const before={env:process.env.VERCEL_ENV,enabled:process.env.LITIX_SMMXPERT_LIVE_ENABLED};
 process.env.VERCEL_ENV="production";
 process.env.LITIX_SMMXPERT_LIVE_ENABLED="true";
 try{
  const fake=vendorCall(()=>({order:98765}));
  await assert.rejects(()=>smmxpertAddClaimedOrder({
   serviceId:3301,link:"https://www.instagram.com/p/abc123/",quantity:100,
   claim:{verifiedPaid:false}
  },{fetchImpl:fake.fetchImpl,key:KEY}),/paid_claim_required/);
  const result=await smmxpertAddClaimedOrder({
   serviceId:3301,link:"https://www.instagram.com/p/abc123/",quantity:100,
   claim:{verifiedPaid:true,oneWayDbClaim:true,
    orderId:"ltx2_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    matchingQuoteApproved:true,approvedServiceIds:["3301"]}
  },{fetchImpl:fake.fetchImpl,key:KEY});
  assert.equal(result.supplierOrderId,"98765");
  assert.deepEqual(fake.calls.map(x=>x.action),["add"]);
 }finally{
  if(before.env===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=before.env;
  if(before.enabled===undefined)delete process.env.LITIX_SMMXPERT_LIVE_ENABLED;
  else process.env.LITIX_SMMXPERT_LIVE_ENABLED=before.enabled;
 }
});
