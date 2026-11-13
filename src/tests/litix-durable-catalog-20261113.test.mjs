import test from "node:test";
import assert from "node:assert/strict";
import {persistVerifiedCatalog,readDurableCatalog} from "../lib/litixDurableCatalog.mjs";
process.env.LITIX_V2_DATABASE_URL="postgresql://fake.example/test";
test("catalog snapshot stores only approved card fields, never supplier secrets",async()=>{
 let saved=[];
 const factory=()=>({query:async(sql,params)=>{
  if(sql.includes("INSERT INTO public.litix_public_catalog_snapshot")){
   saved=JSON.parse(params[0]);
   return [{id:"boostero_1234"}];
  }
  throw Error("Unexpected query");
 }});
 const ok=await persistVerifiedCatalog([
 {id:"boostero_1234",name:"Instagram Likes",category:"Instagram",platform:"Instagram",
  kind:"likes",min:100,max:5000,unitStep:1,type:"Default",per1000:6,
  startingAmountCents:100,purchasable:true,supplier:"TEST_SECRET",apiKey:"DO_NOT_PERSIST"},
 {id:"unsafe_1",per1000:6,startingAmountCents:100,purchasable:true}
 ],{sqlFactory:factory,clock:()=>1000000000});
 assert.equal(ok,true);
 assert.equal(saved.length,1);
 assert.equal(saved[0].id,"boostero_1234");
 assert.equal(Object.hasOwn(saved[0],"supplier"),false);
 assert.equal(Object.hasOwn(saved[0],"apiKey"),false);
});
test("database fallback has cached status and only verified public cards",async()=>{
 const rows=[{card:{id:"boostero_1234",name:"Instagram Likes",category:"Instagram",
 platform:"Instagram",kind:"likes",min:100,max:5000,per1000:6,startingAmountCents:100,
 purchasable:true}},{card:{id:"bad",per1000:1,startingAmountCents:0,purchasable:true}}];
 const out=await readDurableCatalog({sqlFactory:()=>({query:async()=>rows})});
 assert.equal(out.status,"cached");
 assert.equal(out.items.length,1);
 assert.equal(out.items[0].id,"boostero_1234");
});
test("database outage does not enable payments or expose unverified catalog",async()=>{
 const out=await readDurableCatalog({sqlFactory:()=>({query:async()=>{throw Error("db offline")}})});
 assert.deepEqual(out,{status:"unavailable",items:[]});
});
test("catalog fallback is read-only with no configured DB",async()=>{
 delete process.env.LITIX_V2_DATABASE_URL;
 const out=await readDurableCatalog({sqlFactory:()=>{throw Error("should not execute")}});
 assert.deepEqual(out,{status:"unavailable",items:[]});
});
