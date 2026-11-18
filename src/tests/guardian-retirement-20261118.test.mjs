// Owner-requested 2026-11-18 decommission: do not re-enable Guardian alert email.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {deliverGuardianNotice} from "../lib/guardianRuntime.mjs";
const exists=p=>existsSync(new URL("../"+p,import.meta.url));
const text=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("no Guardian website endpoints, dashboard, or external email watchdog",()=>{
 for(const p of [
  "app/api/guardian/cron/route.js","app/api/guardian/probe/route.js",
  "app/api/guardian/admin/route.js","app/guardian/admin/page.jsx","app/guardian/admin/layout.js",
  "../.github/workflows/litix-guardian-external.yml",
  "../src/scripts/guardian-external-monitor.mjs"
 ])assert.equal(exists(p),false,p);
});
test("production crons stop Guardian but preserve order and payment jobs",()=>{
 const crons=JSON.parse(text("vercel.json")).crons.map(x=>x.path);
 assert.ok(!crons.some(x=>x.includes("guardian")));
 for(const p of ["/api/internal/boostero/cron","/api/checkout/settlement/cron","/api/autolikes/cron"])
  assert.ok(crons.includes(p),p);
});
test("disabled Guardian notification sender cannot call Resend",async()=>{
 let called=0;
 const sent=await deliverGuardianNotice({eventKey:"legacy",payload:{event:"outage"},apiKey:"x",
  transport:async()=>{called++;return {ok:true}}});
 assert.equal(sent,false);
 assert.equal(called,0);
 const runtime=text("lib/guardianRuntime.mjs");
 assert.doesNotMatch(runtime,/https:\/\/api\.resend\.com\/emails/);
 assert.match(text("app/api/litix-ai/route.js"),/catalogContext/);
 assert.doesNotMatch(text("app/api/litix-ai/route.js"),/guardianContext/);
});
