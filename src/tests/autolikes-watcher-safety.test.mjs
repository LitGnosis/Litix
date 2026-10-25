import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHmac} from "node:crypto";

const source=readFileSync(new URL("../app/api/v2/cron/profile-watcher/route.js",import.meta.url),"utf8")
 .replace('import { neon } from "@neondatabase/serverless";','const neon=()=>({query:globalThis.__litixWatcherSQL});')
 .replace('import { createHash, createHmac, timingSafeEqual } from "node:crypto";','const {createHash,createHmac,timingSafeEqual}=await import("node:crypto");');
const api=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const cron="cron-test-not-real"+"z".repeat(32),event="event-test-not-real"+"k".repeat(32);
const old={cron:process.env.LITIX_CRON_SECRET,event:process.env.LITIX_AUTOLIKES_EVENT_SECRET,enabled:process.env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED};
process.env.LITIX_CRON_SECRET=cron;process.env.LITIX_AUTOLIKES_EVENT_SECRET=event;
const payload={eventId:"qa_event_012345",workspaceId:"qa_workspace_012345",platform:"instagram",profile:"@test_account",postUrl:"https://www.instagram.com/p/ABC123/",mediaHash:"qa_media_hash_abc123"};
const body=JSON.stringify(payload);
const sig=x=>"sha256="+createHmac("sha256",event).update(x).digest("hex");
const url="https://qa.litix.net/api/v2/cron/profile-watcher";
const req=({method="POST",text=body,signature=true,token=cron}={})=>new Request(url,{method,headers:{"authorization":"Bearer "+token,...(signature?{"x-litix-event-signature":sig(text)}:{})},...(method==="POST"?{body:text}:{} )});
let sqlCalls=0,allowPaid=false;const stored=new Set();
globalThis.__litixWatcherSQL=async(sql,params)=>{
 sqlCalls++;
 if(sql.includes("count(*)::int"))return [{queued:stored.size}];
 if(sql.includes("select w.id,w.campaign_id"))return allowPaid?[{id:"watch-test",campaign_id:"al_fake"}]:[];
 if(sql.includes("insert into litix_profile_events")){
  if(stored.has(params[0]))return [];
  stored.add(params[0]);return [{event_id:params[0]}];
 }
 throw Error("Unexpected SQL");
};
test("AutoLikes worker denies unauthenticated callers without querying private data",async()=>{
 process.env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED="true";
 const count=sqlCalls;
 const denied=await api.GET(req({method:"GET",token:"wrong"}));assert.equal(denied.status,401);
 assert.equal(sqlCalls,count);
});
test("ingestion is disabled by default, even with valid cron and event signature",async()=>{
 delete process.env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED;
 const count=sqlCalls;
 assert.equal((await api.GET(req({method:"GET"}))).status,503);
 assert.equal((await api.POST(req())).status,503);
 assert.equal(sqlCalls,count);
});
test("enabled worker rejects unsigned and invalid signed events",async()=>{
 process.env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED="true";
 const count=sqlCalls;
 assert.equal((await api.POST(req({signature:false}))).status,401);
 const altered=body.replace("instagram.com","notinstagram.com");
 assert.equal((await api.POST(req({text:altered,signature:false}))).status,401);
 assert.equal(sqlCalls,count);
});
test("a signed event without current verified billing and consent is rejected",async()=>{
 allowPaid=false;
 const denied=await api.POST(req());assert.equal(denied.status,403);assert.equal(stored.size,0);
});
test("signed, verified paid events are queued once and never trigger supplier fulfillment",async()=>{
 allowPaid=true;
 const first=await api.POST(req());assert.equal(first.status,200);
 const accepted=await first.json();assert.equal(accepted.accepted,true);assert.equal(accepted.fulfillment,"not triggered; no supplier order placed");
 const second=await api.POST(req());const duplicate=await second.json();
 assert.equal(duplicate.duplicate,true);assert.equal(stored.size,1);
});
test("mismatched post platform is refused after signature check",async()=>{
 const adjusted=JSON.stringify({...payload,postUrl:"https://www.tiktok.com/@someone/video/5"});
 const response=await api.POST(req({text:adjusted}));assert.equal(response.status,400);
});
test("migrations preserve evidence and exactly-once dispatch records",()=>{
 const migration=readFileSync(new URL("../db/migrations/20261025-autolikes-billing-guardrails.sql",import.meta.url),"utf8");
 assert.match(migration,/unique\(campaign_id,post_url\)/i);
 assert.match(migration,/unique\(request_fingerprint\)/i);
 assert.match(migration,/signature_verified boolean not null default false/i);
 assert.match(migration,/litix_profile_events_unique_post/i);
 assert.match(migration,/enable row level security/);
 const text=readFileSync(new URL("../app/api/v2/cron/profile-watcher/route.js",import.meta.url),"utf8");
 assert.doesNotMatch(text,/smm\("add"|smmglob\.com\/api\/v2|recurring:\s*["']add_subscription/);
});
test.after(()=>{for(const [key,name] of [["cron","LITIX_CRON_SECRET"],["event","LITIX_AUTOLIKES_EVENT_SECRET"],["enabled","LITIX_AUTOLIKES_EVENT_INGEST_ENABLED"]]){if(old[key]===undefined)delete process.env[name];else process.env[name]=old[key]}});
