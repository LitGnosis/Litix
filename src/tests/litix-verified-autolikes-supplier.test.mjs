import test from "node:test";
import assert from "node:assert/strict";
import {
 supplierConfigFromEnvironment,createVerifiedFuturePostSupplier,UnknownSupplierOutcome
} from "../lib/litixVerifiedAutoLikesSupplier.mjs";
import {autolikesNewSalesEnabled} from "../lib/litixAutoLikesSalesGate.mjs";

const supplierService={
 service:4321,name:"Instagram Auto Likes for Future Posts",category:"Instagram Likes",
 type:"Subscriptions",rate:"0.3",min:"50",max:"5000"
};
const config={
 LITIX_AUTOLIKES_PROVIDER:"zorasmm",LITIX_ZORASMM_API_KEY:"test_private_demo_key_12345",
 LITIX_AUTOLIKES_RESELLER_VERIFIED:"true",LITIX_AUTOLIKES_PROVIDER_DISPATCH_ENABLED:"true",
 LITIX_AUTOLIKES_IG_SERVICE_ID:"4321"
};
const now=()=>new Date();

test("supplier verification configuration fails closed without key and explicit verification",()=>{
 assert.equal(supplierConfigFromEnvironment({}).canDispatch,false);
 assert.equal(supplierConfigFromEnvironment({...config,LITIX_ZORASMM_API_KEY:""}).canDispatch,false);
 assert.equal(supplierConfigFromEnvironment({...config,LITIX_AUTOLIKES_RESELLER_VERIFIED:"false"}).canDispatch,false);
 assert.equal(supplierConfigFromEnvironment({...config,LITIX_AUTOLIKES_PROVIDER_DISPATCH_ENABLED:"false"}).canDispatch,false);
 assert.equal(supplierConfigFromEnvironment(config).canDispatch,true);
 assert.equal("key" in supplierConfigFromEnvironment(config),false);
 assert.equal(autolikesNewSalesEnabled(),false);
});
test("only a verified live subscription product may prepare a future-post request",async()=>{
 const requests=[];
 const fake=async (_url,opts)=>{
  const params=new URLSearchParams(opts.body);
  requests.push(params.get("action"));
  return {ok:true,json:async()=>[supplierService]};
 };
 const client=createVerifiedFuturePostSupplier({
  provider:"zorasmm",key:"test_private_demo_key_12345",fetcher:fake,
  confirmedServices:{instagram:4321},allowNewOrders:false
 });
 const check=await client.readiness();
 assert.equal(check.connected,true);
 assert.equal(check.ready,false);
 const prep=await client.validate({platform:"instagram",username:"litgnosisllc",likesPerPost:100,postCount:10,now:now()});
 assert.equal(prep.request.action,"add");
 assert.equal(prep.request.old_posts,0);
 assert.equal(prep.request.posts,10);
 await assert.rejects(()=>client.placeSubscription(prep),/supplier_ordering_not_authorized/);
 assert.deepEqual(requests,["services","services"]);
});
test("authorized supplier bridge sends exactly one order, and reports status separately",async()=>{
 const calls=[];
 const fetcher=async (_url,opts)=>{
  const data=Object.fromEntries(new URLSearchParams(opts.body));
  calls.push(data);
  if(data.action==="services")return {ok:true,json:async()=>[supplierService]};
  if(data.action==="add")return {ok:true,json:async()=>({order:876521})};
  if(data.action==="status")return {ok:true,json:async()=>({status:"In progress",remains:700})};
  throw Error("unexpected action");
 };
 const client=createVerifiedFuturePostSupplier({
  provider:"zorasmm",key:"test_private_demo_key_12345",fetcher,
  confirmedServices:{instagram:4321},allowNewOrders:true
 });
 const prep=await client.validate({platform:"instagram",username:"@litgnosisllc",likesPerPost:100,postCount:10,now:now()});
 const result=await client.placeSubscription(prep);
 assert.equal(result.supplierOrderId,"876521");
 const status=await client.getStatus(result.supplierOrderId);
 assert.equal(status.status,"In progress");
 assert.equal(status.remains,700);
 assert.deepEqual(calls.map(x=>x.action),["services","services","add","status"]);
 assert.equal(calls[2].username,"litgnosisllc");
 assert.equal(calls[2].min,"100");
 assert.equal(calls[2].max,"100");
 assert.equal(calls[2].posts,"10");
 assert.equal(calls[2].old_posts,"0");
});
test("on unknown supplier outcome the bridge never silently resends",async()=>{
 const calls=[];
 const fetcher=async (_url,opts)=>{
  const action=new URLSearchParams(opts.body).get("action");
  calls.push(action);
  if(action==="services")return {ok:true,json:async()=>[supplierService]};
  if(action==="add")throw Error("supplier network connection closed after acceptance");
 };
 const client=createVerifiedFuturePostSupplier({provider:"joysmm",key:"test_private_demo_key_12345",fetcher,
  confirmedServices:{instagram:4321},allowNewOrders:true});
 const prepared=await client.validate({platform:"instagram",username:"litgnosisllc",likesPerPost:100,postCount:10});
 await assert.rejects(()=>client.placeSubscription(prepared),UnknownSupplierOutcome);
 assert.equal(calls.filter(x=>x==="add").length,1);
});
test("changed service and tampered payload never reach supplier add",async()=>{
 const requests=[];
 const fetcher=async (_url,opts)=>{
  const action=new URLSearchParams(opts.body).get("action");
  requests.push(action);
  return {ok:true,json:async()=>[supplierService]};
 };
 const client=createVerifiedFuturePostSupplier({provider:"zorasmm",key:"test_private_demo_key_12345",fetcher,
  confirmedServices:{instagram:4321},allowNewOrders:true});
 const prep=await client.validate({platform:"instagram",username:"litgnosisllc",likesPerPost:100,postCount:10});
 await assert.rejects(()=>client.placeSubscription({...prep,request:{...prep.request,posts:100}}),/post_count|Post count|subscription_request_modified|bounds/i);
 assert.equal(requests.filter(x=>x==="add").length,0);
});
