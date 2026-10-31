import test from "node:test";
import assert from "node:assert/strict";
import {boosteroBatchIds,normalizeBoosteroStatus,boosteroChildState,boosteroSupplierDelivered} from "../lib/boosteroStatusBatch.mjs";
test("status batches accept at most 100 unique numeric IDs",()=>{
 assert.deepEqual(boosteroBatchIds(["12977366","12977367"]),["12977366","12977367"]);
 assert.equal(boosteroBatchIds(Array.from({length:100},(_,i)=>String(i+1))).length,100);
 for(const bad of [[],["1","1"],["1","abc"],Array.from({length:101},(_,i)=>String(i+1))])
  assert.throws(()=>boosteroBatchIds(bad));
});
test("provider response validation does not accept unexpected status or invalid remains",()=>{
 assert.deepEqual(normalizeBoosteroStatus({status:"In progress",remains:"897"}),{status:"In progress",remains:897});
 assert.equal(normalizeBoosteroStatus({error:"Incorrect order ID"}),null);
 assert.equal(normalizeBoosteroStatus({status:"Completed",remains:"invalid"}),null);
 assert.equal(normalizeBoosteroStatus({status:"made up"}),null);
 assert.equal(boosteroChildState("Partial"),"MANUAL_REVIEW");
 assert.equal(boosteroChildState("Completed"),"COMPLETED");
});
test("delivery progress never converts unknown remaining into delivered=total",()=>{
 assert.equal(boosteroSupplierDelivered(918,897),21);
 assert.equal(boosteroSupplierDelivered(918,null),null);
 assert.equal(boosteroSupplierDelivered(918,919),null);
});

test("the production adapter only issues an authenticated read-only status batch",async()=>{
 const {boosteroProduction}=await import("../lib/boosteroReadOnly.mjs");
 const vars=["VERCEL_ENV","LITIX_BOOSTERO_ENABLED","BOOSTERO_API_URL","BOOSTERO_API_KEY"];
 const before=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{VERCEL_ENV:"production",LITIX_BOOSTERO_ENABLED:"true",
  BOOSTERO_API_URL:"https://boostero.com/api/v2",BOOSTERO_API_KEY:"mock-key-not-real"});
 try{
  let calls=0;
  const res=await boosteroProduction("status",{orders:["12977366","12977367"]},{fetcher:async(url,opts)=>{
   calls++;
   assert.equal(url,"https://boostero.com/api/v2");
   const body=new URLSearchParams(opts.body);
   assert.equal(body.get("action"),"status");
   assert.equal(body.get("orders"),"12977366,12977367");
   assert.equal(body.get("order"),null);
   assert.equal(body.get("key"),"mock-key-not-real");
   return {ok:true,json:async()=>({
    "12977366":{status:"In progress",remains:"897"},
    "12977367":{status:"Pending",remains:"918"}
   })};
  }});
  assert.equal(calls,1);
  assert.equal(res["12977366"].remains,"897");
  await assert.rejects(()=>boosteroProduction("status",{orders:["12977366","bad"]},{
   fetcher:async()=>{throw Error("must not reach network")}
  }),/boostero_batch_ids_invalid/);
 }finally{
  for(const k of vars)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];
 }
});
