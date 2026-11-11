import test from "node:test";
import assert from "node:assert/strict";
import {SUPPLIER_REGISTRY,REQUIRED_SUPPLIER_EVIDENCE,currentSupplierForNewOrder,
 supplierEvaluation,summarizeIndependentSupplierMetrics,validateAccountService}
 from "../lib/platinumSupplierQualification.mjs";
import {planReadOnlyStatusPolls,normalizePolledStatus,qualificationReadOnlyCall}
 from "../lib/platinumReadOnlySupplierAdapters.mjs";
test("Boostero is only live supplier, every research candidate is disabled",()=>{
 assert.equal(currentSupplierForNewOrder(),"boostero");
 assert.equal(SUPPLIER_REGISTRY.filter(x=>x.enabledForNewOrders).length,1);
 assert.equal(SUPPLIER_REGISTRY.find(x=>x.enabledForNewOrders).code,"boostero");
 for(const s of SUPPLIER_REGISTRY.filter(x=>x.code!=="boostero")){
  assert.equal(s.role,"evaluation_only");assert.equal(s.enabledForNewOrders,false);
  assert.equal(supplierEvaluation(s.code,{}).checkoutAllowed,false);
  assert.ok(supplierEvaluation(s.code,{}).missing.length>=10);
  assert.equal(supplierEvaluation(s.code,Object.fromEntries(REQUIRED_SUPPLIER_EVIDENCE.map(x=>[x,true]))).checkoutAllowed,false);
 }
});
test("supplier registration never accepts account metadata as checkout approval",()=>{
 const proof=Object.fromEntries(REQUIRED_SUPPLIER_EVIDENCE.map(x=>[x,true]));
 assert.equal(supplierEvaluation("morethanpanel",proof).checkoutAllowed,false);
 assert.equal(supplierEvaluation("smmwiz",proof).proposedIntegrationApproved,false);
 assert.equal(supplierEvaluation("justanotherpanel_live",proof).checkoutAllowed,false);
 assert.equal(supplierEvaluation("fakepanel",proof).checkoutAllowed,false);
});
test("real measured samples are distinguished from historical uptime",()=>{
 const m=summarizeIndependentSupplierMetrics([{timestamp:"2026-10-28T12:00:00Z",success:true,latencyMs:100},
  {timestamp:"2026-10-28T12:05:00Z",success:false,latencyMs:250}]);
 assert.equal(m.availabilityPercent,50);assert.equal(m.p95LatencyMs,250);
 assert.equal(m.historicalUptimeVerified,false);
 assert.equal(summarizeIndependentSupplierMetrics([]).verified,false);
});
test("candidate supplier catalog requires numeric service IDs and valid price and limits",()=>{
 assert.equal(validateAccountService({service:123,rate:"1.2",min:50,max:5000,type:"Default"}).valid,true);
 assert.equal(validateAccountService({service:123,rate:"0",min:50,max:5000,type:"Default"}).valid,false);
 assert.equal(validateAccountService({service:123,rate:"1",min:500,max:50,type:"Default"}).valid,false);
 assert.equal(validateAccountService({service:123,rate:"1",min:50,max:5000,type:""}).valid,false);
});
test("MoreThanPanel uses bounded status polling chunks without changing orders",()=>{
 const plans=planReadOnlyStatusPolls("morethanpanel",Array.from({length:215},(_,i)=>String(i+1000)));
 assert.deepEqual(plans.map(x=>x.orders.length),[100,100,15]);
 assert.ok(plans.every(x=>x.action==="status"&&x.minDelayMs>=1000&&x.accountOwnershipRequired));
 assert.throws(()=>planReadOnlyStatusPolls("smmwiz",["1"]),/not_documented/);
 assert.throws(()=>planReadOnlyStatusPolls("morethanpanel",["1","not-an-id"]),/invalid_owned/);
});
test("polling status never translates zero remains into verified delivery",()=>{
 const status=normalizePolledStatus({status:"Completed",remains:0});
 assert.equal(status.valid,true);assert.equal(status.paymentVerified,false);
 assert.equal(status.deliveryIndependentlyVerified,false);
 assert.equal(normalizePolledStatus({error:"incorrect id"}).valid,false);
});
test("live environment blocks all candidate probes and all actions that mutate supplier state",async()=>{
 let called=0;const f=async()=>{called++;return new Response("[]")};
 const base={provider:"morethanpanel",apiKey:"fictional-test-key-12345",fetchImpl:f,ownerAuthorized:true};
 await assert.rejects(qualificationReadOnlyCall({...base,action:"services",environment:"production"}),/authorized_preview/);
 for(const a of ["add","cancel","refill","bulk_submit","status_webhook"]){
  await assert.rejects(qualificationReadOnlyCall({...base,action:a}),/not_permitted/);
 }
 await assert.rejects(qualificationReadOnlyCall({...base,action:"services",ownerAuthorized:false}),/authorized_preview/);
 assert.equal(called,0);
});
test("JAP JSON service probe uses pinned official live domain, no credential in URL or response logs",async()=>{
 let count=0;const apiKey="fictional-jap-secret-test-1234";
 const fetchImpl=async(url,options)=>{
  count++;assert.equal(url,"https://www.justanotherpanel.live/api/public/v2");
  assert.equal(options.method,"POST");assert.ok(!url.includes(apiKey));
  assert.equal(options.headers["content-type"],"application/json");
  assert.equal(JSON.parse(options.body).key,apiKey);
  assert.equal(JSON.parse(options.body).action,"services");
  return new Response(JSON.stringify([{service:123,rate:"0.5",min:"100",max:"1000",type:"Default"}]),{status:200});
 };
 const list=await qualificationReadOnlyCall({provider:"justanotherpanel_live",action:"services",apiKey,
  environment:"preview",ownerAuthorized:true,fetchImpl});
 assert.equal(list.length,1);assert.equal(count,1);
});
test("MoreThanPanel query uses POST body and checks application-level errors",async()=>{
 const apiKey="fictional-morethanpanel-secret-1234";
 const fetchImpl=async(url,options)=>{
  assert.equal(url,"https://morethanpanel.com/api/v2");
  assert.equal(new URLSearchParams(options.body).get("action"),"status");
  assert.equal(new URLSearchParams(options.body).get("orders"),"12,13");
  assert.ok(!url.includes(apiKey));
  return new Response(JSON.stringify({error:"Incorrect order ID"}),{status:200});
 };
 await assert.rejects(qualificationReadOnlyCall({provider:"morethanpanel",action:"status",ownedOrderIds:["12","13"],
  environment:"preview",ownerAuthorized:true,apiKey,fetchImpl}),/supplier_response_error/);
});
