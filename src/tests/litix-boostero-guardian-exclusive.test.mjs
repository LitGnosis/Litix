import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {componentKeys} from "../lib/guardianCore.mjs";
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Guardian actively checks Boostero, never calls retired supplier",()=>{
 const runtime=file("lib/guardianRuntime.mjs");
 assert.equal(componentKeys.includes("boostero"),true);
 assert.equal(componentKeys.includes("smmglob"),false);
 assert.match(runtime,/boosteroProduction\("services"\)/);
 assert.match(runtime,/BOOSTERO_READ_ONLY_OK/);
 assert.match(runtime,/\["boostero","resend"\]\.filter\(recent\)/);
 assert.doesNotMatch(runtime,/smmglob|SMMGLOB|smmfollowom|SMMFOLLOWOM/i);
 assert.doesNotMatch(runtime,/boosteroProduction\("add"/);
});
test("retired daily catalog cron is removed, current Boostero polling remains",()=>{
 const cron=JSON.parse(file("vercel.json")).crons;
 assert.equal(cron.some(c=>c.path==="/api/v2/cron/sync-catalog"),false);
 assert.equal(cron.some(c=>c.path==="/api/internal/boostero/cron"),true);
 assert.equal(cron.some(c=>c.path==="/api/guardian/cron"),true);
 const admin=file("app/api/guardian/admin/route.js");
 assert.match(admin,/component <> 'smmglob'/);
});
test("no changed payment, order dispatch or customer data dependency",()=>{
 const route=file("app/api/internal/boostero/cron/route.js");
 assert.match(route,/syncBoosteroStatuses\(/);
 assert.match(route,/bearer/);
 const guardian=file("lib/guardianRuntime.mjs");
 assert.match(guardian,/deliverGuardianNotice/);
});
