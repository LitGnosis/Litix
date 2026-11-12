import test from "node:test";
import assert from "node:assert/strict";
import {GET as catalog} from "../app/api/bundles/route.js";
import {POST as checkout} from "../app/api/bundles/checkout/route.js";
import {GET as adminGet,POST as adminPost} from "../app/api/bundles/admin/route.js";
import {POST as mappingWrite} from "../app/api/bundles/mappings/route.js";
import {GET as track} from "../app/api/bundles/order/route.js";

test("preview bundle catalog exposes all eight offers but cannot expose card payment",async()=>{
 const prev=process.env.VERCEL_ENV;
 process.env.VERCEL_ENV="preview";
 try{
  const res=await catalog(),body=await res.json();
  assert.equal(res.status,200);
  assert.equal(body.packages.length,8);
  assert.equal(body.checkoutEnabled,false);
  assert.equal(body.publicKey,null);
 }finally{if(prev===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=prev}
});
test("bundle checkout rejects unauthorized launch without payment or supplier calls",async()=>{
 const before=globalThis.fetch,old=process.env.VERCEL_ENV;
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error("External gateway not allowed")};
 process.env.VERCEL_ENV="preview";
 try{
  const req=new Request("https://litix.net/api/bundles/checkout",{method:"POST",
    headers:{origin:"https://litix.net","content-type":"application/json"},
    body:JSON.stringify({packageId:"ig_launch",whatsappConsent:true})});
  const res=await checkout(req),body=await res.json();
  assert.equal(res.status,503);
  assert.match(body.error,/not yet enabled/);
  assert.equal(calls,0);
 }finally{globalThis.fetch=before;if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old}
});
test("no admin token means no post approval or supplier fulfillment",async()=>{
 const old=process.env.LITIX_BUNDLES_ADMIN_TOKEN;
 delete process.env.LITIX_BUNDLES_ADMIN_TOKEN;
 try{
  const get=await adminGet(new Request("https://litix.net/api/bundles/admin"));
  assert.equal(get.status,401);
  const post=await adminPost(new Request("https://litix.net/api/bundles/admin",{method:"POST",headers:{origin:"https://litix.net"},body:"{}"}));
  assert.equal(post.status,401);
  const map=await mappingWrite(new Request("https://litix.net/api/bundles/mappings",{method:"POST",headers:{origin:"https://litix.net"},body:"{}"}));
  assert.equal(map.status,401);
 }finally{if(old!==undefined)process.env.LITIX_BUNDLES_ADMIN_TOKEN=old}
});
test("a tracking record requires a private authenticated token",async()=>{
 const r=await track(new Request("https://litix.net/api/bundles/order?id=lbg_does-not-exist"));
 assert.equal(r.status,400);
});
