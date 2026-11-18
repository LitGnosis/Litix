import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {nextGuardianState,componentKeys} from "../lib/guardianCore.mjs";
import {deliverGuardianNotice,bearerAuthorized} from "../lib/guardianRuntime.mjs";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Guardian requires two consecutive failures and two successes; dedupes outage and recovery",()=>{
 const t0=new Date("2026-10-27T10:00:00Z"),t1=new Date("2026-10-27T10:05:00Z"),t2=new Date("2026-10-27T10:10:00Z");
 const bad={component:"catalog",ok:false,code:"CATALOG_EMPTY_OR_INVALID"};
 const good={component:"catalog",ok:true,code:"LIVE_SERVICES"};
 const first=nextGuardianState(null,bad,t0);
 assert.equal(first.next.status,"degraded");assert.deepEqual(first.events,[]);
 const second=nextGuardianState(first.next,bad,t1);
 assert.equal(second.next.status,"down");assert.equal(second.events[0].kind,"outage");
 const ongoing={...second.next,active_incident_id:"gi_fixed",alert_at:t1.toISOString()};
 const repeat=nextGuardianState(ongoing,bad,t2);
 assert.equal(repeat.next.status,"down");assert.equal(repeat.events.length,0);
 const escalated=nextGuardianState(ongoing,bad,new Date("2026-10-27T11:20:00Z"));
 assert.equal(escalated.events[0].kind,"escalation");
 const withEscalation={...escalated.next,active_incident_id:"gi_fixed",alert_at:t1.toISOString(),escalation_at:"2026-10-27T11:20:00Z"};
 assert.deepEqual(nextGuardianState(withEscalation,bad,new Date("2026-10-27T11:25:00Z")).events,[]);
 const recovering=nextGuardianState(ongoing,good,new Date("2026-10-27T11:30:00Z"));
 assert.equal(recovering.next.status,"degraded");assert.deepEqual(recovering.events,[]);
 const recovered=nextGuardianState(recovering.next,good,new Date("2026-10-27T11:35:00Z"));
 assert.equal(recovered.next.status,"healthy");assert.deepEqual(recovered.events,[{kind:"recovery",id:"gi_fixed"}]);
 assert.deepEqual(nextGuardianState(recovered.next,good,new Date("2026-10-27T11:40:00Z")).events,[]);
});
test("usable cached catalog stays degraded, not down; prior outage recovers after two checks",()=>{
 const cached={component:"tiktok",ok:true,kind:"degraded",code:"CATALOG_CACHED_USABLE"};
 const initial=nextGuardianState(null,cached,new Date("2026-10-27T16:10:00Z"));
 assert.equal(initial.next.status,"degraded");assert.deepEqual(initial.events,[]);
 const subsequent=nextGuardianState(initial.next,cached,new Date("2026-10-27T16:15:00Z"));
 assert.equal(subsequent.next.status,"degraded");assert.deepEqual(subsequent.events,[]);
 assert.equal(subsequent.next.consecutive_failures,0);
 const incident={...initial.next,status:"down",active_incident_id:"gi_existing",consecutive_failures:2,consecutive_successes:0,alert_at:"2026-10-27T16:00:00Z"};
 const one=nextGuardianState(incident,cached,new Date("2026-10-27T16:20:00Z"));
 assert.equal(one.next.status,"degraded");assert.deepEqual(one.events,[]);
 const recovered=nextGuardianState(one.next,cached,new Date("2026-10-27T16:25:00Z"));
 assert.equal(recovered.next.status,"degraded");
 assert.deepEqual(recovered.events,[{kind:"recovery",id:"gi_existing"}]);
 assert.equal(recovered.next.active_incident_id,null);
 assert.deepEqual(nextGuardianState(recovered.next,cached,new Date("2026-10-27T16:30:00Z")).events,[]);
 const invalid={component:"tiktok",ok:false,code:"CATALOG_EMPTY_OR_INVALID"};
 const failureOne=nextGuardianState(recovered.next,invalid,new Date("2026-10-27T16:35:00Z"));
 const failureTwo=nextGuardianState(failureOne.next,invalid,new Date("2026-10-27T16:40:00Z"));
 assert.equal(failureTwo.next.status,"down");
 assert.deepEqual(failureTwo.events,[{kind:"outage"}]);
 assert.equal(existsSync(new URL("../app/api/guardian/probe/route.js",import.meta.url)),false);
 assert.match(file("lib/guardianRuntime.mjs"),/CATALOG_CACHED_USABLE/);
});
test("not-yet-launched AutoLikes is tracked honestly, never as an outage",()=>{
 const p=nextGuardianState(null,{component:"autolikes",kind:"not_launched",ok:true,code:"AUTOLIKES_COMING_SOON"},new Date("2026-10-27"));
 assert.equal(p.next.status,"not_launched");assert.equal(p.events.length,0);
 assert.ok(componentKeys.includes("resend")&&componentKeys.includes("fulfillment")&&componentKeys.includes("tiktok"));
 assert.ok(componentKeys.includes("boostero")&&componentKeys.includes("multi_post")&&componentKeys.includes("email_delivery"));
 assert.ok(!componentKeys.includes("smmglob"));
});
test("retired Guardian cannot send email, even when invoked with an injected transport",async()=>{
 let calls=0;
 const sent=await deliverGuardianNotice({eventKey:"old",payload:{event:"outage"},apiKey:"unused",
  transport:async()=>{calls++;return {ok:true}}});
 assert.equal(sent,false);
 assert.equal(calls,0);
});
test("Guardian routes and dashboard are physically absent; customer crons remain",()=>{
 for(const path of ["app/api/guardian/cron/route.js","app/api/guardian/admin/route.js",
  "app/api/guardian/probe/route.js","app/guardian/admin/page.jsx","app/guardian/admin/layout.js"]){
  assert.equal(existsSync(new URL("../"+path,import.meta.url)),false,path+" must not be deployed");
 }
 assert.equal(bearerAuthorized(new Request("https://litix.net",{headers:{authorization:"Bearer wrong"}}),"a".repeat(32)),false);
 const crons=JSON.parse(file("vercel.json")).crons;
 assert.equal(crons.some(x=>x.path==="/api/guardian/cron"),false);
 for(const route of ["/api/internal/boostero/cron","/api/checkout/settlement/cron","/api/autolikes/cron"])
  assert.ok(crons.some(x=>x.path===route),route+" must remain scheduled");
 const runtime=file("lib/guardianRuntime.mjs");
 assert.doesNotMatch(runtime,/https:\/\/api\.resend\.com\/emails/);
});
test("Guardian recognizes the live Automatic Likes landing-page text",()=>{
 const runtime=file("lib/guardianRuntime.mjs");
 assert.match(runtime,/t\.includes\("Automatic Likes for Your Next Posts"\)/);
 assert.match(runtime,/AUTOLIKES_PAGE/);
});
