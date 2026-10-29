import test from "node:test";
import assert from "node:assert/strict";
import {POST,GET} from "../app/api/checkout/boostero-typed/v1/route.js";
const envNames=["LITIX_BOOSTERO_TYPED_ORDERS_ENABLED","VERCEL_ENV"];
test("typed checkout fails closed with zero gateway or supplier calls until owner-approved",async()=>{
 const before=Object.fromEntries(envNames.map(k=>[k,process.env[k]]));
 const oldFetch=globalThis.fetch;
 let outbound=0;
 try{
  process.env.VERCEL_ENV="production";
  process.env.LITIX_BOOSTERO_TYPED_ORDERS_ENABLED="false";
  globalThis.fetch=async()=>{outbound++;throw Error("unexpected external call")};
  const request=new Request("https://www.litix.net/api/checkout/boostero-typed/v1",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({serviceId:"service_000000000000000000000000",paymentToken:"FAKE_TEST_ONLY"})
  });
  const r=await POST(request),body=await r.json();
  assert.equal(r.status,503);
  assert.equal(body.paymentAttempted,false);assert.equal(body.supplierOrderSubmitted,false);
  assert.equal(outbound,0);
  assert.equal((await GET()).status,405);
 }finally{
  globalThis.fetch=oldFetch;
  for(const k of envNames)before[k]===undefined?delete process.env[k]:process.env[k]=before[k];
 }
});
