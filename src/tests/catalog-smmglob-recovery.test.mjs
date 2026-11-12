import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=()=>readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8")
 .replace('import { after } from "next/server";','const after=()=>{};')
 .replace('import { sendOrderEmails, notificationsConfigured } from "../../../lib/orderNotifications.mjs";','const sendOrderEmails=async()=>true;const notificationsConfigured=()=>false;')
 .replace('"../../../lib/pricing.mjs"',JSON.stringify(new URL("../lib/pricing.mjs",import.meta.url).href))
 .replace('"../../../lib/catalogSort.mjs"',JSON.stringify(new URL("../lib/catalogSort.mjs",import.meta.url).href))
 .replace('import { neon } from "@neondatabase/serverless";','const neon=()=>{throw Error("Catalog must not access DB")};');
const row=(service,name,extra={})=>({service,name,category:name,rate:1,min:100,max:50000,type:"Default",...extra});
const list=[
 row(510,"TikTok Likes USA | no drop 30 days",{refill:true}),
 row(511,"TikTok Followers regular"),
 row(512,"Instagram Likes USA | no drop",{refill:true}),
 row(513,"Instagram Followers regular"),
 row(514,"YouTube views US",{refill:true}),
 row(33771,"Instagram excluded Likes")
];
async function prepare(t){
 const originalFetch=globalThis.fetch,originalKey=process.env.SMMGLOB_API_KEY;
 process.env.SMMGLOB_API_KEY="test-only-not-real";
 t.after(()=>{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=originalKey;});
 const {GET}=await import("data:text/javascript;base64,"+Buffer.from(load()+"\n// "+Math.random()).toString("base64"));
 const get=async qs=>{const r=await GET(new Request("https://www.litix.net/api/smmservices?"+(qs||"")));return {status:r.status,body:await r.json()};};
 return get;
}
test("read-only SMMGLOB services call retries once after terminated, preserves catalog prices and TikTok search",async t=>{
 let calls=0;
 globalThis.fetch=async (url,init)=>{
  calls++;
  assert.equal(String(url),"https://smmglob.com/api/v2");
  assert.equal(init.method,"POST");
  assert.equal(init.body.get("action"),"services");
  assert.ok(init.body.get("key"));
  assert.equal(init.body.has("service"),false);
  assert.equal(init.body.has("order"),false);
  if(calls===1)throw Error("terminated");
  return Response.json(list);
 };
 const get=await prepare(t);
 const result=await get("platform=TikTok");
 assert.equal(result.status,200);
 assert.equal(calls,2);
 assert.equal(result.body.catalogStatus,"live");
 assert.equal(result.body.supplierRawCount,list.length);
 assert.ok(result.body.lastSupplierSuccessAt);
 assert.equal(result.body.total,2);
 assert.deepEqual(new Set(result.body.items.map(x=>x.id)),new Set(["510","511"]));
 assert.equal(result.body.items.find(x=>x.id==="510").per1000,9,"existing USA-targeted price remains unchanged");
 const ig=await get("platform=Instagram");
 assert.equal(ig.status,200);
 assert.equal(ig.body.total,2);
 assert.equal(calls,2,"recent verified cache avoids duplicate supplier calls");
});
test("supplier authentication failure returns 503 and does not fabricate live connection",async t=>{
 let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({error:"Invalid API key"})};
 const get=await prepare(t);
 const out=await get();
 assert.equal(out.status,503);
 assert.equal(out.body.catalogStatus,"unavailable");
 assert.equal(out.body.allCount,0);
 assert.equal(out.body.items.length,0);
 assert.equal(calls,1,"do not retry authentication errors");
});
test("a zero-result filter never implies the supplier has zero services",async t=>{
 globalThis.fetch=async()=>Response.json(list);
 const get=await prepare(t);
 const out=await get("platform=TikTok&q=nonexistent");
 assert.equal(out.status,200);
 assert.equal(out.body.total,0);
 assert.equal(out.body.items.length,0);
 assert.equal(out.body.allCount,4);
 assert.equal(out.body.catalogStatus,"live");
});
test("client displays zero filter matches separately from supplier health and does not alter pricing/checkout",()=>{
 const page=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");
 const api=load();
 assert.match(page,/match current filters/);
 assert.match(page,/Showing recently verified catalog/);
 assert.match(page,/no services match these filters/);
 assert.match(page,/42000/);
 assert.match(api,/action==="services"\?18000:16000/);
 assert.match(api,/catalogStatus:/);
 assert.match(api,/supplierRawCount/);
 assert.match(api,/calculateOrderCents\(qty,retailPer1000\(service\)\)/);
 assert.match(api,/smm\("add"/);
});
