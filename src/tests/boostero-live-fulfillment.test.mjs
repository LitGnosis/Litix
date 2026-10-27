import test from "node:test";
import assert from "node:assert/strict";
import {boosteroProduction} from "../lib/boosteroReadOnly.mjs";
import {boosteroProfile,boosteroQuote,boosteroAdminAuthorized,boosteroProductionReady,dispatchBoostero} from "../lib/boosteroFulfillment.mjs";

const saved=Object.fromEntries(["VERCEL_ENV","LITIX_BOOSTERO_ENABLED","BOOSTERO_API_KEY","BOOSTERO_API_URL","LITIX_BOOSTERO_DATABASE_URL"].map(k=>[k,process.env[k]]));
function enable(){
 process.env.VERCEL_ENV="production";process.env.LITIX_BOOSTERO_ENABLED="true";
 process.env.BOOSTERO_API_KEY="FAKE_LOCAL_ONLY_KEY";process.env.BOOSTERO_API_URL="https://boostero.com/api/v2";
 process.env.LITIX_BOOSTERO_DATABASE_URL="postgres://example.invalid/fake";
}
function restore(){for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v}
const supplier={id:"5461",name:"Instagram Followers No Refill",category:"Instagram Followers",platform:"Instagram",
 min:10,max:500000,wholesalePer1000USD:3,refillClaim:false};
const approved={enabled:true,supplier_service_id:"5461",platform:"instagram",retail_per_1000_cents:1500,wholesale_ceiling_per_1000:"3.500000"};
test("hard-gated for production and impossible to send unauthorized add/status/refill",async()=>{
 enable();try{
  process.env.LITIX_BOOSTERO_ENABLED="false";
  await assert.rejects(boosteroProduction("add",{service:"5461",quantity:500,link:"https://www.instagram.com/test/"},
   {claimed:true}),/disabled/);
  process.env.LITIX_BOOSTERO_ENABLED="true";
  await assert.rejects(boosteroProduction("add",{service:"5461",quantity:500,link:"https://www.instagram.com/test/"},{fetcher:async()=>{throw Error("should not send")}}),/not_authorized/);
  await assert.rejects(boosteroProduction("refill",{order:"1234"},{fetcher:async()=>{throw Error("should not send")}}),/needs_approval/);
  await assert.rejects(boosteroProduction("add",{service:"5461",quantity:500,link:"https://evil.test/abc"},
   {claimed:true,fetcher:async()=>{throw Error("must not send")}}),/not_authorized/);
 }finally{restore()}
});
test("allowlist plus existing Litix markup and $5 floor prevents underpriced sale",()=>{
 const quote=boosteroQuote({service:supplier,approved,quantity:500});
 assert.equal(quote.amountCents,750);assert.equal(quote.wholesaleCents,150);
 assert.throws(()=>boosteroQuote({service:supplier,approved:{...approved,enabled:false},quantity:500}),/not_approved/);
 assert.throws(()=>boosteroQuote({service:supplier,approved:{...approved,retail_per_1000_cents:999},quantity:500}),/retail_not_approved/);
 assert.throws(()=>boosteroQuote({service:supplier,approved,quantity:100}),/five_dollar/);
 const refill={...supplier,name:"Instagram Followers 30 Days Refill",wholesalePer1000USD:5.9,refillClaim:true};
 assert.throws(()=>boosteroQuote({service:refill,approved,quantity:500}),/wholesale_changed/);
 const expensive={...supplier,name:"Instagram Followers 30 Days Refill",wholesalePer1000USD:3.78,refillClaim:true};
 assert.throws(()=>boosteroQuote({service:expensive,approved:{...approved,wholesale_ceiling_per_1000:4},quantity:500}),/breaks_litix_retail_ladder/);
});
test("canonical profile URLs reject credentials, post URLs and query fragments",()=>{
 assert.equal(boosteroProfile("@test.username","instagram"),"https://www.instagram.com/test.username/");
 assert.equal(boosteroProfile("https://www.tiktok.com/@test.user","tiktok"),"https://www.tiktok.com/@test.user/");
 for(const bad of ["https://instagram.com/p/1234","https://instagram.com.evil.test/foo","https://instagram.com/test?a=1","https://example.com/abc"]){
  assert.equal(boosteroProfile(bad,"instagram"),null);
 }
});
test("admin secret uses exact length and timing-safe comparison",()=>{
 const key="x".repeat(50);
 assert.equal(boosteroAdminAuthorized("Bearer "+key,key),true);
 assert.equal(boosteroAdminAuthorized("Bearer "+"y".repeat(50),key),false);
 assert.equal(boosteroAdminAuthorized("Bearer "+key,"short"),false);
});
test("accepted supplier add creates once, stores independent ID and blocks repeat dispatch",async()=>{
 enable();
 let state="QUEUED",orders=0,addCalls=0;
 const sql={query:async (sqlText,params=[])=>{
  if(sqlText.startsWith("update public.litix_boostero_fulfillment f set state='DISPATCHING'")){
   if(state!=="QUEUED")return [];state="DISPATCHING";return [{supplier_service_id:"5461"}];
  }
  if(sqlText.startsWith("insert into public.litix_boostero_attempts"))return [];
  if(sqlText.startsWith("select o.destination,o.quantity"))return [{destination:"https://www.instagram.com/test.user/",quantity:500,supplier_service_id:"5461"}];
  if(sqlText.startsWith("select * from public.litix_boostero_services"))return [approved];
  if(sqlText.startsWith("update public.litix_boostero_fulfillment set supplier_order_id")){
   state="SUBMITTED";return [{supplier_order_id:params[1]}];
  }
  return [];
 }};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  const action=new URLSearchParams(options.body).get("action");
  if(action!=="services")throw Error("unexpected real network");
  return Response.json([{service:5461,name:supplier.name,category:supplier.category,
   min:10,max:500000,rate:3,refill:false}]);
 };
 try{
  const op=async(action,params,options)=>{
   if(action==="balance")return {balance:"50.00"};
   if(action==="add"){assert.equal(options.claimed,true);addCalls++;return {order:123456}}
   throw Error("action forbidden");
  };
  const first=await dispatchBoostero("ltx2_11111111-1111-4111-8111-111111111111",{sql,operation:op});
  assert.equal(first.submitted,true);assert.equal(first.supplierOrderId,"123456");
  const second=await dispatchBoostero("ltx2_11111111-1111-4111-8111-111111111111",{sql,operation:op});
  assert.equal(second.submitted,false);
  assert.equal(addCalls,1);
 }finally{globalThis.fetch=originalFetch;restore()}
});
test("uncertain supplier timeout locks fulfillment; never resubmits",async()=>{
 enable();
 let state="QUEUED",calls=0;
 const sql={query:async(x,params=[])=>{
  if(x.startsWith("update public.litix_boostero_fulfillment f set state='DISPATCHING'")){
   if(state!=="QUEUED")return [];state="DISPATCHING";return [{supplier_service_id:"5461"}];
  }
  if(x.startsWith("select o.destination,o.quantity"))return [{destination:"https://www.instagram.com/test.user/",quantity:500,supplier_service_id:"5461"}];
  if(x.startsWith("select * from public.litix_boostero_services"))return [approved];
  if(x.startsWith("update public.litix_boostero_fulfillment set state=$2")){state=params[1];return []}
  return [];
 }};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>Response.json([{service:5461,name:supplier.name,category:supplier.category,min:10,max:500000,rate:3,refill:false}]);
 try{
  const op=async(action)=>{if(action==="balance")return {balance:500};calls++;throw Error("network may have charged supplier")};
  const first=await dispatchBoostero("ltx2_11111111-1111-4111-8111-111111111111",{sql,operation:op});
  assert.equal(first.state,"UNKNOWN_OUTCOME");assert.equal(first.requiresReview,true);
  await dispatchBoostero("ltx2_11111111-1111-4111-8111-111111111111",{sql,operation:op});
  assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;restore()}
});
