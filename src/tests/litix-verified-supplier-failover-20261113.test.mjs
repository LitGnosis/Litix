import test from "node:test";
import assert from "node:assert/strict";
import {classifySupplierResponse,supplierConfiguration,verifyMappedService,
 dispatchVerifiedSupplierOrder} from "../lib/litixVerifiedSupplierRouter.mjs";

const primary={litix_service_id:"boostero_1234",supplier_code:"SMMWIZ",
 supplier_service_id:"55",priority:1,enabled:true,owner_approved:true,
 verified_at:"2026-11-13",platform:"Instagram",kind:"likes",country_scope:"unspecified",
 wholesale_rate_per_1000_usd:"5.00"};
const backup={...primary,supplier_code:"JAP",supplier_service_id:"66",priority:2};
const listing=(id)=>[{service:String(id),name:"Instagram Likes",category:"Instagram Likes",
 type:"Default",rate:"5.00",min:100,max:5000}];
const orderId="ltx2_12345678-1234-1234-1234-123456789abc";

test("only allowlisted HTTPS provider configuration accepts keys",()=>{
 assert.throws(()=>supplierConfiguration("UNKNOWN",{env:{}}),/not_allowlisted/);
 assert.throws(()=>supplierConfiguration("SMMWIZ",{env:{LITIX_SMMWIZ_API_KEY:"very-long-secret-key",
 LITIX_SMMWIZ_API_URL:"https://127.0.0.1/api/v2"}}),/not_allowlisted/);
 assert.equal(supplierConfiguration("SMMWIZ",{env:{LITIX_SMMWIZ_API_KEY:"very-long-secret-key"}})
   .url,"https://smmwiz.com/api/v2");
});

test("automatic failover only after explicit service rejection, never on unknown response",()=>{
 assert.deepEqual(classifySupplierResponse({error:"Service not found"},{action:"add"}),
 {state:"PROVIDER_REJECTED",reason:"service_unavailable"});
 assert.equal(classifySupplierResponse({error:"An unexpected error"},{action:"add"}).state,
 "UNKNOWN_OUTCOME");
 assert.equal(classifySupplierResponse({error:"Invalid quantity"},{action:"add"}).state,
 "UNKNOWN_OUTCOME");
 assert.equal(classifySupplierResponse({order:98765},{action:"add"}).state,"SUBMITTED");
 assert.equal(classifySupplierResponse({status:"ok"},{action:"add"}).state,"UNKNOWN_OUTCOME");
});

test("live service metadata, quantity, and wholesale ceiling must match",()=>{
 assert.ok(verifyMappedService(primary,listing(55),1000,800));
 assert.equal(verifyMappedService(primary,listing(56),1000,800),null);
 assert.equal(verifyMappedService(primary,listing(55),1000,799),null);
 assert.equal(verifyMappedService(primary,listing(55),6000,9000),null);
 assert.equal(verifyMappedService({...primary,owner_approved:false},listing(55),1000,800),null);
 assert.equal(verifyMappedService(primary,[{...listing(55)[0],rate:"5.01"}],1000,800),null);
});

function fakeSql(routes){
 const audit=[],states=[];
 const sql={query:async (q,p)=>{
  audit.push(q);
  if(q.includes("INSERT INTO public.litix_supplier_route_claims"))return [{litix_order_id:orderId}];
  if(q.includes("SELECT id,service_id,quantity,amount_cents,destination"))return [{
   id:orderId,service_id:"boostero_1234",quantity:1000,amount_cents:800,
   destination:"https://www.instagram.com/p/ABC123/"}];
  if(q.includes("SELECT * FROM public.litix_verified_supplier_routes"))return routes;
  if(q.includes("INSERT INTO public.litix_supplier_failover_attempts"))return [{id:p[0]}];
  if(q.includes("UPDATE public.litix_supplier_failover_attempts"))return [{id:p[0]}];
  if(q.includes("UPDATE public.litix_v2_orders"))return [{id:orderId}];
  if(q.includes("UPDATE public.litix_supplier_route_claims")){states.push(p[1]);return [{id:orderId}]}
  throw Error("Unexpected query: "+q.slice(0,100));
 }};
 return {sql,audit,states};
}

test("verified primary rejection calls approved fallback exactly once",async()=>{
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV="production";
 try{
  const f=fakeSql([primary,backup]),adds=[];
  const result=await dispatchVerifiedSupplierOrder(orderId,{enabled:true,sql:f.sql,
    requestSupplier:async(code,action)=>{
      if(action==="services")return listing(code==="SMMWIZ"?55:66);
      if(action==="balance")return {balance:"1000",currency:"USD"};
      if(action==="add"){
       adds.push(code);
       return code==="SMMWIZ"?{state:"PROVIDER_REJECTED",reason:"service_unavailable"}:
        {state:"SUBMITTED",supplierOrderId:"99123"};
      }
    }});
  assert.equal(result.state,"SUBMITTED");
  assert.deepEqual(adds,["SMMWIZ","JAP"]);
  assert.deepEqual(f.states,["SUBMITTED"]);
 }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old}
});

test("transport ambiguity never calls a second supplier",async()=>{
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV="production";
 try{
  const f=fakeSql([primary,backup]),adds=[];
  const result=await dispatchVerifiedSupplierOrder(orderId,{enabled:true,sql:f.sql,
    requestSupplier:async(code,action)=>{
      if(action==="services")return listing(code==="SMMWIZ"?55:66);
      if(action==="balance")return {balance:1000,currency:"USD"};
      if(action==="add"){adds.push(code);throw Error("connection closed after POST")}
    }});
  assert.equal(result.state,"MANUAL_REVIEW");
  assert.deepEqual(adds,["SMMWIZ"]);
  assert.deepEqual(f.states,["MANUAL_REVIEW"]);
 }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old}
});

test("new supplier router stays off by default and never connects to DB",async()=>{
 const result=await dispatchVerifiedSupplierOrder(orderId,{enabled:false});
 assert.equal(result.state,"DISABLED");
});
