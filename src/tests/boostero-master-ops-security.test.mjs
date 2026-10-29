import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {boosteroRetailCandidate} from "../lib/boosteroRetail25.mjs";
import {logBoosteroSyncEvent,previewBoosteroRetention,readBoosteroSyncEvents} from "../lib/boosteroSyncEvents.mjs";
const source=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
test("decimal markup has deterministic exact-cent round-up",()=>{
 assert.equal(boosteroRetailCandidate("20.000001").retailCents,5001);
 assert.equal(boosteroRetailCandidate("0.999999").retailCents,500);
 assert.equal(boosteroRetailCandidate("1e-2").retailCents,null);
 assert.equal(boosteroRetailCandidate("19.999999").reviewReason,"existing_markup_floor_conflict");
});
test("owner monitoring requires signed session before any query",async()=>{
 const {GET}=await import("../app/api/owner/boostero/route.js");
 const response=await GET(new Request("https://www.litix.net/api/owner/boostero"));
 assert.equal(response.status,401);
 const data=await response.json();
 assert.match(data.error,/Auth0 session/);
});
test("unauthorized manual sync cannot trigger supplier",async()=>{
 const previous=process.env.VERCEL_ENV;process.env.VERCEL_ENV="production";
 try{
  const {POST}=await import("../app/api/internal/boostero/inventory-sync/route.js");
  const response=await POST(new Request("https://www.litix.net/api/internal/boostero/inventory-sync",{method:"POST"}));
  assert.equal(response.status,401);
 }finally{
  if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;
 }
});
test("sync log stores only counts, safe code and normalized reasons",async()=>{
 const calls=[];
 const db={query:async(q,args)=>{calls.push({q,args});return []}};
 await logBoosteroSyncEvent(db,{runId:"11111111-1111-4111-8111-111111111111",
  operation:"SYNC_FAILED",level:"ERROR",errorCode:"unsafe password=abc",received:1817,rejected:3,
  reasons:{"invalid_wholesale":2,"secret token=foo":5}});
 assert.equal(calls.length,1);
 assert.equal(calls[0].args[10],"UNSAFE_PASSWORD_ABC");
 assert.equal(JSON.parse(calls[0].args[11]).invalid_wholesale,2);
 assert.equal(JSON.parse(calls[0].args[11])["secret token=foo"],undefined);
 assert.equal(calls[0].args[12],true);
});
test("event pagination and retention are bounded, read-only",async()=>{
 const queries=[];
 const db={query:async(q,args)=>{queries.push({q,args});return q.includes("count(*)")?[{candidates:12}]:[]}};
 await readBoosteroSyncEvents(db,{page:4,pageSize:250});
 await previewBoosteroRetention(db,{days:0});
 assert.deepEqual(queries[0].args,[50,150]);
 assert.equal(queries[1].args[0],14);
 assert.doesNotMatch(queries.map(x=>x.q).join(" "),/\b(?:delete|truncate|drop)\s+from\b/i);
});
test("source release gates prevent unaudited production sync",()=>{
 const route=source("app/api/internal/boostero/inventory-sync/route.js");
 assert.match(route,/LITIX_BOOSTERO_BACKUP_VERIFIED/);
 assert.match(route,/LITIX_BOOSTERO_GLOBAL_SYNC_ENABLED/);
 assert.match(route,/ownerRequest\(req\)/);
 assert.match(route,/litix_boostero_sync_lock/);
 const migration=source("db/migrations/20261029-boostero-master-ops-additive.sql");
 assert.match(migration,/litix_boostero_sync_events/);
 assert.match(migration,/validation_state/);
});

test("routine retention cannot delete without verified backup and release approval",async()=>{
 const {pruneBoosteroRoutineLogs}=await import("../lib/boosteroSyncEvents.mjs");
 const calls=[];
 const db={query:async(q,args)=>{calls.push({q,args});return [{deleted:2}]}};
 const result=await pruneBoosteroRoutineLogs(db,{authorized:false});
 assert.equal(result.deleted,0);
 assert.equal(calls.length,0);
 const code=source("lib/boosteroSyncEvents.mjs");
 assert.match(code,/protected_incident=false/);
 assert.match(code,/NOT EXISTS/);
 assert.doesNotMatch(code,/DELETE FROM public\.litix_v2_orders/);
});
test("daily maintenance route requires cron or owner session",async()=>{
 const prev=process.env.VERCEL_ENV;process.env.VERCEL_ENV="production";
 try{
  const {GET,POST}=await import("../app/api/internal/boostero/maintenance/route.js");
  assert.equal((await GET(new Request("https://www.litix.net/api/internal/boostero/maintenance"))).status,401);
  assert.equal((await POST(new Request("https://www.litix.net/api/internal/boostero/maintenance",{method:"POST"}))).status,401);
 }finally{if(prev===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=prev}
});
