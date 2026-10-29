import test from "node:test";
import assert from "node:assert/strict";
import {dispatchBoosteroTypedPaidOrder} from "../lib/boosteroTypedPaidDispatch.mjs";
const oid="ltx2_11111111-1111-4111-8111-111111111111";
const original=Object.fromEntries(["VERCEL_ENV","LITIX_BOOSTERO_ENABLED","LITIX_BOOSTERO_TYPED_ORDERS_ENABLED","BOOSTERO_API_KEY","BOOSTERO_API_URL"].map(k=>[k,process.env[k]]));
function setLiveFake(){
 process.env.VERCEL_ENV="production";
 process.env.LITIX_BOOSTERO_ENABLED="true";
 process.env.LITIX_BOOSTERO_TYPED_ORDERS_ENABLED="true";
 process.env.BOOSTERO_API_KEY="FAKE_LOCAL_TEST_KEY";
 process.env.BOOSTERO_API_URL="https://boostero.com/api/v2";
}
function cleanup(){for(const [k,v] of Object.entries(original))v===undefined?delete process.env[k]:process.env[k]=v}
const catalog=[{service:9876,name:"Instagram Views",category:"Instagram Views",rate:"10",type:"Default",min:"50",max:"10000"}];
const row={id:oid,quantity:500,amount_cents:800,payment_state:"paid",payment_transaction_id:"mock-verified-tx",
 metadata:{boostero_typed_draft:{link:"https://www.instagram.com/p/ABCDEFGH/",quantity:500}},
 state:"QUEUED",supplier_service_id:"9876",order_type:"Default",
 approved_wholesale_ceiling:"10.50",approved_retail_per_1000_cents:1600,special_contract_verified:false};
function fakeSql(){
 let state="QUEUED",providerId=null;
 const calls=[],sql={query:async(text,params=[])=>{
  calls.push(text);
  if(text.includes("select o.id,o.quantity"))return state==="QUEUED"?[row]:[];
  if(text.includes("from public.litix_boostero_inventory where supplier_service_id"))return [{supplier_service_id:"9876",order_type:"Default",wholesale_per_1000:"10",active:true}];
  if(text.includes("set state='DISPATCHING'")){if(state!=="QUEUED")return [];state="DISPATCHING";return [{supplier_service_id:"9876"}]}
  if(text.includes("set state='UNKNOWN_OUTCOME'")){state="UNKNOWN_OUTCOME";return []}
  if(text.includes("set supplier_order_id=$2,state='SUBMITTED'")){if(state!=="DISPATCHING")return [];state="SUBMITTED";providerId=params[1];return [{supplier_order_id:providerId}]}
  return [];
 }};
 return {sql,calls,getState:()=>state,getSupplier:()=>providerId};
}
test("typed service dispatch is disabled unless a separately approved production release is active",async()=>{
 const fake=fakeSql();const x=await dispatchBoosteroTypedPaidOrder(oid,{sql:fake.sql,inventorySQL:fake.sql,enabled:true,liveServices:catalog,
  fetchImpl:async()=>{throw Error("network must stay unused")}});
 assert.equal(x.state,"TYPED_DISPATCH_DISABLED");assert.equal(fake.calls.length,0);
});
test("confirmed paid order is submitted at most once with a durable DB claim",async()=>{
 setLiveFake();
 try{
  const fake=fakeSql();let network=0;
  const fetchImpl=async(url,options)=>{
   network++;
   assert.equal(url,"https://boostero.com/api/v2");
   assert.equal(options.method,"POST");
   assert.equal(new URLSearchParams(options.body).get("action"),"add");
   assert.equal(new URLSearchParams(options.body).get("service"),"9876");
   assert.equal(new URLSearchParams(options.body).get("quantity"),"500");
   return new Response(JSON.stringify({order:456789}),{status:200});
  };
  const first=await dispatchBoosteroTypedPaidOrder(oid,{sql:fake.sql,inventorySQL:fake.sql,liveServices:catalog,enabled:true,fetchImpl});
  assert.equal(first.submitted,true);assert.equal(first.supplierOrderId,"456789");
  const second=await dispatchBoosteroTypedPaidOrder(oid,{sql:fake.sql,inventorySQL:fake.sql,liveServices:catalog,enabled:true,fetchImpl});
  assert.equal(second.submitted,false);
  assert.equal(network,1);assert.equal(fake.getState(),"SUBMITTED");assert.equal(fake.getSupplier(),"456789");
 }finally{cleanup()}
});
test("unknown supplier response never automatically retries",async()=>{
 setLiveFake();
 try{
  const fake=fakeSql();let network=0;
  const fetchImpl=async()=>{network++;throw Error("ambiguous supplier timeout")};
  const x=await dispatchBoosteroTypedPaidOrder(oid,{sql:fake.sql,inventorySQL:fake.sql,liveServices:catalog,enabled:true,fetchImpl});
  assert.equal(x.state,"UNKNOWN_OUTCOME");assert.equal(fake.getState(),"UNKNOWN_OUTCOME");
  await dispatchBoosteroTypedPaidOrder(oid,{sql:fake.sql,inventorySQL:fake.sql,liveServices:catalog,enabled:true,fetchImpl});
  assert.equal(network,1);
 }finally{cleanup()}
});
test("rejects unauthenticated paid-order evidence and unverified special order terms before claim",async()=>{
 setLiveFake();
 try{
  const fake=fakeSql();let network=0;
  const noPrice=await dispatchBoosteroTypedPaidOrder(oid,{sql:fake.sql,inventorySQL:fake.sql,
   liveServices:[{...catalog[0],rate:"30"}],enabled:true,fetchImpl:async()=>{network++}});
  assert.equal(noPrice.state,"SUPPLIER_SERVICE_OR_PRICE_CHANGED");
  const special=await dispatchBoosteroTypedPaidOrder(oid,{sql:fake.sql,inventorySQL:fake.sql,
   liveServices:[{...catalog[0],type:"Package"}],enabled:true,fetchImpl:async()=>{network++}});
  assert.equal(special.submitted,false);assert.equal(network,0);
  assert.equal(fake.getState(),"QUEUED");
 }finally{cleanup()}
});
