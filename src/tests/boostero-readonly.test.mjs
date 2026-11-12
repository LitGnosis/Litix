import test from "node:test";
import assert from "node:assert/strict";
import {boosteroReadOnly,boosteroFollowers} from "../lib/boosteroReadOnly.mjs";
const envNames=["VERCEL_ENV","BOOSTERO_API_KEY","BOOSTERO_API_URL"];
async function withEnv(changes,fn){
 const prev=Object.fromEntries(envNames.map(k=>[k,process.env[k]]));
 Object.entries(changes).forEach(([k,v])=>v===null?delete process.env[k]:process.env[k]=v);
 try{return await fn()}finally{Object.entries(prev).forEach(([k,v])=>v==null?delete process.env[k]:process.env[k]=v);}
}
test("only allow read-only balance/services in preview",async()=>{
 await withEnv({VERCEL_ENV:"preview",BOOSTERO_API_KEY:"test-only",BOOSTERO_API_URL:"https://boostero.com/api/v2"},async()=>{
  await assert.rejects(boosteroReadOnly("add"),/forbidden/);
  await assert.rejects(boosteroReadOnly("status"),/forbidden/);
  await assert.rejects(boosteroReadOnly("orders"),/forbidden/);
 });
 await withEnv({VERCEL_ENV:"production",BOOSTERO_API_KEY:"test-only",BOOSTERO_API_URL:"https://boostero.com/api/v2"},async()=>{
  await assert.rejects(boosteroReadOnly("balance"),/preview_only/);
 });
});
test("uses credential server-side in POST body, not URL, response, or logs",async()=>{
 await withEnv({VERCEL_ENV:"preview",BOOSTERO_API_KEY:"FAKE_UNIT_ONLY_KEY",BOOSTERO_API_URL:"https://boostero.com/api/v2"},async()=>{
  let requests=0;
  const fetcher=async(url,options)=>{
   requests++;
   assert.equal(url,"https://boostero.com/api/v2");
   assert.equal(options.method,"POST");assert.equal(options.redirect,"error");
   assert.equal(new URLSearchParams(options.body).get("key"),"FAKE_UNIT_ONLY_KEY");
   assert.equal(new URLSearchParams(options.body).get("action"),"balance");
   return Response.json({balance:"12.34",currency:"USD"});
  };
  const b=await boosteroReadOnly("balance",{fetcher});
  assert.equal(b.balance,"12.34");
  assert.equal(requests,1);
 });
});
test("untrusted endpoint and provider errors fail closed without leaking messages",async()=>{
 await withEnv({VERCEL_ENV:"preview",BOOSTERO_API_KEY:"FAKE_UNIT_ONLY_KEY",BOOSTERO_API_URL:"https://evil.example/api/v2"},async()=>{
  await assert.rejects(boosteroReadOnly("services",{fetcher:async()=>{throw Error("should not run")}}),/allowlisted/);
 });
 await withEnv({VERCEL_ENV:"preview",BOOSTERO_API_KEY:"FAKE_UNIT_ONLY_KEY",BOOSTERO_API_URL:"https://boostero.com/api/v2"},async()=>{
  await assert.rejects(boosteroReadOnly("balance",{fetcher:async()=>Response.json({error:"Invalid API key FAKE_UNIT_ONLY_KEY"})}),e=>!String(e.message).includes("FAKE_UNIT_ONLY_KEY"));
 });
});
test("filter follower services, distinguish refill from non-drop/no refill",()=>{
 const out=boosteroFollowers([
  {service:1,name:"Instagram Followers 30 Days Refill",category:"Instagram",rate:"2.50",min:"100",max:"10000",refill:true},
  {service:2,name:"TikTok Followers Lifetime Refill",category:"TikTok",rate:"3.00",min:500,max:50000,refill:true},
  {service:3,name:"Instagram Followers No Refill",category:"Instagram",rate:"2.00",min:50,max:1000,refill:false},
  {service:4,name:"TikTok Likes 90 Day",category:"TikTok",rate:1,min:10,max:1000},
  {service:5,name:"Instagram Followers Non Drop",category:"Instagram",rate:2,min:10,max:10000},
  {service:6,name:"TikTok Followers 30 Days Manual Refill",category:"TikTok",rate:3.74,min:10,max:15000,refill:false}
 ]);
 assert.equal(out.length,5);
 assert.equal(out.filter(x=>x.refill30Plus).length,3);
 assert.equal(out.find(x=>x.id==="1").refillDays,30);
 assert.equal(out.find(x=>x.id==="2").refillDays,"lifetime");
 assert.equal(out.find(x=>x.id==="3").refillClaim,false);
 assert.equal(out.find(x=>x.id==="5").refill30Plus,false);
 assert.equal(out.find(x=>x.id==="6").refill30Plus,true);
 assert.equal(out.find(x=>x.id==="6").refillMethod,"manual advertised");
 assert.equal(out.find(x=>x.id==="6").apiRefillEligible,false);
});
