import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
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
test("not-yet-launched AutoLikes is tracked honestly, never as an outage",()=>{
 const p=nextGuardianState(null,{component:"autolikes",kind:"not_launched",ok:true,code:"AUTOLIKES_COMING_SOON"},new Date("2026-10-27"));
 assert.equal(p.next.status,"not_launched");assert.equal(p.events.length,0);
 assert.ok(componentKeys.includes("resend")&&componentKeys.includes("fulfillment")&&componentKeys.includes("tiktok"));
});
test("preview-simulated outage and recovery alert via mocked Resend, with no customer data",async()=>{
 const sent=[];
 const transport=async(url,init)=>{
  sent.push({url,headers:init.headers,body:JSON.parse(init.body)});
  return {ok:true};
 };
 for(const kind of ["outage","recovery"]){
  const payload={time:"2026-10-27T10:00:00.000Z",component:"tiktok",event:kind,
   code:kind==="outage"?"NO_TIKTOK_SERVICES":"LIVE_SERVICES",
   detail:"TikTok read-only catalog verification",probableCause:"CATALOG",repair:"Inspect read-only supplier services"};
  const result=await deliverGuardianNotice({
   eventKey:"guardian-gi_fixed-"+kind,payload,apiKey:"TEST_ONLY",transport
  });
  assert.equal(result,true);
 }
 assert.equal(sent.length,2);
 for(let i=0;i<2;i++){
  assert.equal(sent[i].url,"https://api.resend.com/emails");
  assert.equal(sent[i].body.to[0],"Litixsocial@gmail.com");
  assert.equal(sent[i].headers["idempotency-key"],"guardian-gi_fixed-"+(i===0?"outage":"recovery"));
  assert.doesNotMatch(JSON.stringify(sent[i].body),/customer_email|tracking_token|card_number|api_key|security_key/);
 }
 assert.match(sent[0].body.subject,/OUTAGE/);
 assert.match(sent[1].body.subject,/RECOVERY/);
});
test("cron route and dashboard are authenticated; no public destructive diagnostic endpoints",async()=>{
 const {GET:cron}=await import("../app/api/guardian/cron/route.js");
 const {GET:admin}=await import("../app/api/guardian/admin/route.js");
 const a=await cron(new Request("https://litix.net/api/guardian/cron"));
 const b=await admin(new Request("https://litix.net/api/guardian/admin"));
 assert.equal(a.status,401);assert.equal(b.status,401);
 assert.equal(bearerAuthorized(new Request("https://litix.net",{headers:{authorization:"Bearer wrong"}}),"a".repeat(32)),false);
 for(const p of ["app/api/guardian/cron/route.js","app/api/guardian/admin/route.js","app/api/guardian/probe/route.js"]){
  const c=file(p);assert.doesNotMatch(c,/smm\("add"|type:"sale"|markPaid|update\s+litix_v2_orders/);
 }
});
test("scheduled monitoring is additive and independent of existing Vercel crons",()=>{
 const crons=JSON.parse(file("vercel.json")).crons;
 assert.deepEqual(crons.filter(x=>x.path==="/api/guardian/cron").map(x=>x.schedule),["*/5 * * * *"]);
 assert.equal(crons.filter(x=>x.path==="/api/bundles/cron").length,1);
 assert.equal(crons.filter(x=>x.path==="/api/v2/cron/sync-catalog").length,1);
 const runtime=file("lib/guardianRuntime.mjs");
 assert.match(runtime,/action:"services"/);
 assert.match(runtime,/select count\(\*\)/);
 assert.match(runtime,/idempotency-key/);
 assert.doesNotMatch(runtime,/action:"add"|type:"sale"|security_key/);
});
