import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=readFileSync(new URL("../app/api/v2/cron/autolikes-dispatch/route.js",import.meta.url),"utf8")
 .replace('import { neon } from "@neondatabase/serverless";','const neon=()=>({query:globalThis.__litixDispatchSQL});')
 .replace('import { createHash, timingSafeEqual } from "node:crypto";','const { createHash,timingSafeEqual }=await import("node:crypto");');
const api=await import("data:text/javascript;base64,"+Buffer.from(src).toString("base64"));
const original={...process.env},fetch0=globalThis.fetch;
const secret="unit-cron-secret-12345678901234567890";
const ev={event_id:"event_test_1",workspace_id:"ws_test",campaign_id:"al_example",post_url:"https://www.instagram.com/p/post12345/",service_catalog_id:"33588",quantity_per_post:500};
const url="https://qa.litix.net/api/v2/cron/autolikes-dispatch";
const req=t=>new Request(url,{headers:{authorization:"Bearer "+t}});
let selectEvents=()=>[],claims=new Set(),supplierCalls=0;
globalThis.__litixDispatchSQL=async(sql,params)=>{
 if(sql.includes("select e.event_id"))return selectEvents();
 if(sql.includes("insert into litix_autolikes_delivery_claims")){
  if(claims.has(params[0]))return [];
  claims.add(params[0]);return [{id:params[0]}];
 }
 if(sql.includes("update litix_autolikes_delivery_claims")||sql.includes("update litix_profile_events"))return [];
 throw Error("Unexpected SQL query");
};
globalThis.fetch=async(_url,opts)=>{
 supplierCalls++;
 assert.equal(opts.body.get("action"),"add");
 assert.equal(opts.body.get("service"),"33588");
 assert.equal(opts.body.get("link"),ev.post_url);
 return Response.json({order:123456});
};
test("dispatch always refuses unauthorized callers before database/supplier access",async()=>{
 process.env.LITIX_CRON_SECRET=secret;
 process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED="true";
 process.env.SMMGLOB_API_KEY="not-a-real-key";
 let touched=false,old=globalThis.__litixDispatchSQL;
 globalThis.__litixDispatchSQL=async()=>{touched=true;return []};
 assert.equal((await api.GET(req("wrong"))).status,401);
 assert.equal(touched,false);
 globalThis.__litixDispatchSQL=old;
});
test("dispatch stays off unless explicitly enabled",async()=>{
 delete process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED;
 assert.equal((await api.GET(req(secret))).status,503);
 assert.equal(supplierCalls,0);
});
test("no verified paid post events means zero supplier orders",async()=>{
 process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED="true";
 assert.equal((await api.GET(req(secret))).status,200);
 assert.equal(supplierCalls,0);
});
test("paid event dispatch has a durable single-use claim; repeated delivery is prevented",async()=>{
 selectEvents=()=>[ev];
 let r=await api.GET(req(secret));assert.equal(r.status,200);
 assert.equal((await r.json()).confirmed,1);
 assert.equal(supplierCalls,1);
 r=await api.GET(req(secret));const data=await r.json();
 assert.equal(data.skipped,1);
 assert.equal(supplierCalls,1);
});
test.after(()=>{globalThis.fetch=fetch0;globalThis.__litixDispatchSQL=undefined;for(const k of ["LITIX_CRON_SECRET","LITIX_AUTOLIKES_DISPATCH_ENABLED","SMMGLOB_API_KEY"]){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k]}});
