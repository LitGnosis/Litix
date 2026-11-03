import test from "node:test";
import assert from "node:assert/strict";
import {supplierTrialReadOnly,TRIAL_PROVIDERS,summarizeSupplierTrialServices} from "../lib/supplierTrialReadOnly.mjs";

const KEY="test-key-that-is-long-enough";
const services=[
 {service:100,name:"Instagram Likes USA",category:"Instagram Likes",type:"Default",rate:"1.25",min:"100",max:"200000",refill:true,cancel:false},
 {service:101,name:"TikTok Followers",category:"TikTok Followers",type:"Default",rate:"1.99",min:"100",max:"10000",refill:false,cancel:true},
 {service:102,name:"Broken",category:"Instagram Views",rate:"garbled",min:"20",max:"2"}
];
function fixtureTransport(data=services){
 const calls=[];
 const transport=async(url,options)=>{
  calls.push({url,options});
  return {ok:true,status:200,json:async()=>data};
 };
 return {transport,calls};
}

test("each vendor can only call its verified static HTTPS API endpoint",async()=>{
 for(const [provider,meta] of Object.entries(TRIAL_PROVIDERS)){
  const {transport,calls}=fixtureTransport();
  const result=await supplierTrialReadOnly({provider,action:"services",key:KEY,transport});
  assert.equal(result.validCount,2);
  assert.equal(result.receivedCount,3);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,meta.endpoint);
  assert.equal(calls[0].options.method,"POST");
  assert.equal(calls[0].options.redirect,"error");
  const params=new URLSearchParams(calls[0].options.body);
  assert.equal(params.get("action"),"services");
  assert.equal(params.get("key"),KEY);
  assert.equal(params.has("order"),false);
  assert.equal(params.has("orders"),false);
  assert.ok(!JSON.stringify(result).includes(KEY),"API key never returned to caller");
  const summary=summarizeSupplierTrialServices(result);
  assert.equal(summary.qualifiedServices.length,2);
  assert.equal(summary.platformCounts.Instagram,1);
  assert.equal(summary.platformCounts.TikTok,1);
 }
});
test("only safe catalog, balance and owned status actions are ever permitted",async()=>{
 const {transport,calls}=fixtureTransport();
 for(const action of ["add","refill","cancel","pay","create","deposit","refund",null,"ADD"]){
  await assert.rejects(()=>supplierTrialReadOnly({provider:"smmxpert",action,key:KEY,transport}),
   /supplier_trial_action_not_read_only/);
 }
 assert.equal(calls.length,0,"reject all order-related actions before any network call");
 await assert.rejects(()=>supplierTrialReadOnly({provider:"unknown",action:"services",key:KEY,transport}),
  /provider_not_approved/);
 await assert.rejects(()=>supplierTrialReadOnly({provider:"smmxpert",action:"status",key:KEY,transport,orderIds:["12977366"],ownedTrialIds:[]}),
  /order_ids_not_owned/);
 assert.equal(calls.length,0,"never probe an old Boostero ID or unrelated supplier order");
});

test("balances require a valid amount and preserve currency rather than assuming USD",async()=>{
 const {transport}=fixtureTransport({balance:"12.34",currency:"INR"});
 const b=await supplierTrialReadOnly({provider:"smmxpert",action:"balance",key:KEY,transport});
 assert.deepEqual(b,{provider:"smmxpert",action:"balance",balance:12.34,currency:"INR"});
 const invalid=fixtureTransport({balance:"",currency:"USD"});
 await assert.rejects(()=>supplierTrialReadOnly({provider:"morethanpanel",action:"balance",key:KEY,transport:invalid.transport}),
  /balance_invalid/);
});

test("owned trial statuses are batched and never issue additional orders",async()=>{
 const result={101:{status:"Pending",remains:"100",charge:"0.10"},
  102:{status:"Completed",remains:"0",charge:"0.20"}};
 const {transport,calls}=fixtureTransport(result);
 const data=await supplierTrialReadOnly({
  provider:"morethanpanel",action:"status",key:KEY,transport,
  orderIds:["101","102"],ownedTrialIds:["101","102"]
 });
 assert.equal(calls.length,1);
 assert.equal(new URLSearchParams(calls[0].options.body).get("action"),"status");
 assert.equal(new URLSearchParams(calls[0].options.body).get("orders"),"101,102");
 assert.deepEqual(data.byId.map(z=>z.status),["Pending","Completed"]);
 assert.deepEqual(data.byId.map(z=>z.remains),[100,0]);
});

test("HTTP 200 vendor errors are rejected without leaking bodies or credentials",async()=>{
 const {transport}=fixtureTransport({error:"Invalid API key test-key-that-is-long-enough"});
 await assert.rejects(()=>supplierTrialReadOnly({provider:"smmxpert",action:"services",key:KEY,transport}),
  /provider_rejected_request/);
 const failed=async()=>({ok:false,status:503,json:async()=>({error:"token secret"})});
 await assert.rejects(()=>supplierTrialReadOnly({provider:"morethanpanel",action:"balance",key:KEY,transport:failed}),
  /http_unavailable/);
});
