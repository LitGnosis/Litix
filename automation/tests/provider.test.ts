import test from "node:test";
import assert from "node:assert/strict";
import type {Supplier} from "@prisma/client";
import {add,status,balanceCents,requestCancellation,RejectedOrder,UnknownOutcome} from "../src/provider.js";

const supplier={
 id:"boostero",endpointUrl:"https://boostero.com/api/v2",
 credentialEnvKey:"BOOSTERO_API_KEY",approved:true,state:"ACTIVE"
} as Supplier;
async function mock<T>(answer:unknown,run:()=>Promise<T>,httpStatus=200):Promise<T>{
 const oldFetch=globalThis.fetch,oldKey=process.env.BOOSTERO_API_KEY;
 process.env.BOOSTERO_API_KEY="ci-fake-key";
 globalThis.fetch=async(_url,init)=>{
  assert.equal((_url as string),"https://boostero.com/api/v2");
  assert.equal(init?.method,"POST");
  const p=new URLSearchParams(String(init?.body));
  assert.equal(p.get("key"),"ci-fake-key");
  return new Response(JSON.stringify(answer),{status:httpStatus});
 };
 try{return await run();}
 finally{
  globalThis.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.BOOSTERO_API_KEY;
  else process.env.BOOSTERO_API_KEY=oldKey;
 }
}
test("one order returns validated supplier ID",async()=>{
 assert.equal(await mock({order:12345},()=>add(supplier,"7","https://instagram.com/p/a/",500)),"12345");
});
test("supplier semantic rejection does not retry blindly",async()=>{
 await assert.rejects(()=>mock({error:"Quantity less than minimal"},()=>add(supplier,"7","https://instagram.com/p/a/",1)),RejectedOrder);
});
test("accepted but malformed receipt becomes ambiguous",async()=>{
 await assert.rejects(()=>mock({order:null},()=>add(supplier,"7","https://instagram.com/p/a/",500)),UnknownOutcome);
});
test("balance must be USD and can detect low funds",async()=>{
 assert.equal(await mock({balance:"49.99",currency:"USD"},()=>balanceCents(supplier)),4999);
 await assert.rejects(()=>mock({balance:"49.99",currency:"EUR"},()=>balanceCents(supplier)),/SUPPLIER_BALANCE_INVALID/);
});
test("status maps remaining quantity exactly",async()=>{
 assert.deepEqual(await mock({status:"Partial",remains:"157"},()=>status(supplier,"23")),
  {status:"Partial",remains:157});
});
test("cancellation request is not terminal proof",async()=>{
 assert.equal(await mock([{order:23,cancel:1}],()=>requestCancellation(supplier,"23")),true);
 assert.equal(await mock([{order:23,cancel:{error:"Not possible"}}],()=>requestCancellation(supplier,"23")),false);
});
test("refuses unallowlisted supplier endpoint",async()=>{
 await assert.rejects(()=>mock({order:23},()=>add(
  {...supplier,endpointUrl:"https://unknown.example.com/api/v2"},"7","https://instagram.com/p/a/",500)),/SUPPLIER_NOT_ALLOWLISTED/);
});
