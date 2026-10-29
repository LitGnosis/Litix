import test from "node:test";
import assert from "node:assert/strict";
import {alertBoosteroInventorySync} from "../lib/boosteroInventoryAlerts.mjs";
const prior=Object.fromEntries(["VERCEL_ENV","RESEND_API_KEY","LITIX_RESEND_API_KEY"].map(x=>[x,process.env[x]]));
const restore=()=>{for(const [k,v] of Object.entries(prior))v===undefined?delete process.env[k]:process.env[k]=v};
test("preview and missing email credentials cannot trigger owner mail",async()=>{
 let calls=0;process.env.VERCEL_ENV="preview";process.env.RESEND_API_KEY="FAKE_TEST";
 try{const result=await alertBoosteroInventorySync("inventory_catalog_shrink",{fetchImpl:async()=>{calls++;throw Error("unexpected")}});
  assert.equal(result.sent,false);assert.equal(calls,0);
 }finally{restore()}
});
test("only safe sanitized codes are emitted; no wholesale or API keys in body",async()=>{
 process.env.VERCEL_ENV="production";process.env.RESEND_API_KEY="FAKE_LOCAL_TEST";
 try{
  let calls=0;
  const f=async(url,init)=>{
   calls++;assert.equal(url,"https://api.resend.com/emails");
   assert.match(init.headers["Idempotency-Key"],/^litix-boostero-inventory\/2026-10-29\//);
   assert.ok(!init.body.includes("FAKE_LOCAL_TEST"));
   const data=JSON.parse(init.body);
   assert.ok(data.to.includes("litixsocial@gmail.com"));
   assert.match(data.text,/inventory_sync_unavailable/);
   return new Response(JSON.stringify({id:"example"}),{status:200});
  };
  const good=await alertBoosteroInventorySync("inventory_sync_unavailable",{fetchImpl:f,now:new Date("2026-10-29T12:00:00Z")});
  assert.equal(good.sent,true);
  const bad=await alertBoosteroInventorySync("secret=abc-123",{fetchImpl:f});
  assert.equal(bad.sent,false);assert.equal(calls,1);
 }finally{restore()}
});
