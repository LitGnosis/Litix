import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
let source=readFileSync(new URL("../lib/liveAutoLikes.mjs",import.meta.url),"utf8");
source=source.replace('import { neon } from "@neondatabase/serverless";','const neon=()=>({query:(...a)=>globalThis.__testAutoSQL(...a)});');
source=source.replace('import { fetchLikesServices } from "./autolikes.mjs";','const fetchLikesServices=async()=>globalThis.__testAutoCatalog;');
const api=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const before={...process.env},originalFetch=globalThis.fetch;
process.env.VERCEL_ENV="production";
process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED="true";
process.env.SMMGLOB_API_KEY="simulated-key-never-used-on-network";
globalThis.__testAutoCatalog=[{service:1234,min:100,max:10000}];
let claims=0,calls=0,lastBody=null,sqlUpdates=[];
const row=()=>({post_id:"alp_evidence",post_url:"https://www.instagram.com/p/Abc12345/",service_id:"1234",likes:100,platform:"instagram"});
globalThis.__testAutoSQL=async (sql,...params)=>{
 if(sql.includes("litix_claim_autolikes_live_post"))return claims++===0?[row()]:[];
 if(sql.includes("update litix_autolikes_live_posts")||sql.includes("update litix_autolikes_live_subscriptions")){sqlUpdates.push([sql,params]);return [];}
 throw Error("Unexpected SQL");
};
test("accepted supplier order occurs once even after duplicate delivery event",async()=>{
 claims=0;calls=0;sqlUpdates=[];
 globalThis.fetch=async(url,options)=>{
  calls++;lastBody=options.body;
  assert.equal(new URL(url).hostname,"smmglob.com");
  return Response.json({order:34564});
 };
 const a=await api.dispatchLivePost("alp_evidence");
 const b=await api.dispatchLivePost("alp_evidence");
 assert.equal(a.state,"SUBMITTED");assert.equal(b.claimed,false);
 assert.equal(calls,1);
 assert.equal(lastBody.get("service"),"1234");
 assert.equal(lastBody.get("quantity"),"100");
 assert.equal(lastBody.get("link"),row().post_url);
});
test("unavailable supplier ID or quantity cannot place a chargeable supplier order",async()=>{
 claims=0;calls=0;sqlUpdates=[];
 globalThis.__testAutoCatalog=[{service:5555,min:100,max:10000}];
 globalThis.fetch=async()=>{calls++;throw Error("No paid supplier action allowed")};
 const result=await api.dispatchLivePost("alp_expired_service");
 assert.equal(result.state,"DECLINED");
 assert.equal(calls,0);
 assert.ok(sqlUpdates.some(([sql])=>sql.includes("set posts_remaining=least(")));
 globalThis.__testAutoCatalog=[{service:1234,min:100,max:10000}];
});
test("unpaid, paused or expired entitlement cannot dispatch without database reservation",async()=>{
 claims=1;calls=0;globalThis.fetch=async()=>{calls++;throw Error("unexpected")};
 const a=await api.dispatchLivePost("alp_unpaid");
 assert.equal(a.claimed,false);assert.equal(calls,0);
});
test("upstream timeout never fails over or automatically retries an ambiguous purchase",async()=>{
 claims=0;calls=0;
 globalThis.fetch=async()=>{calls++;throw Error("simulated timeout")};
 const a=await api.dispatchLivePost("alp_timeout");
 const b=await api.dispatchLivePost("alp_timeout");
 assert.equal(a.state,"UNKNOWN_OUTCOME");assert.equal(b.claimed,false);assert.equal(calls,1);
});
test("supplier explicit rejection does not spend a monthly post allowance",async()=>{
 claims=0;calls=0;sqlUpdates=[];
 globalThis.fetch=async()=>{calls++;return Response.json({error:"invalid service"})};
 const a=await api.dispatchLivePost("alp_rejected");
 assert.equal(a.state,"DECLINED");assert.equal(calls,1);
 assert.ok(sqlUpdates.some(([sql])=>sql.includes("set posts_remaining=least(")));
});
test.after(()=>{
 globalThis.fetch=originalFetch;globalThis.__testAutoSQL=undefined;globalThis.__testAutoCatalog=undefined;
 for(const key of ["VERCEL_ENV","LITIX_AUTOLIKES_DISPATCH_ENABLED","SMMGLOB_API_KEY"]){
  if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];
 }
});
