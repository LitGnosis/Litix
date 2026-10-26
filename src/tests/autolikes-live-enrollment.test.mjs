import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const route=readFileSync(new URL("../app/api/account/subscribe/route.js",import.meta.url),"utf8");
const ledger=readFileSync(new URL("../db/migrations/20261025-autolikes-enrollment-guard.sql",import.meta.url),"utf8");
test("live enrollment requires production merchant permission and is never enabled by preview",()=>{
 assert.match(route,/process\.env\.VERCEL_ENV==="production"/);
 assert.match(route,/process\.env\.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true"/);
 assert.match(route,/process\.env\.LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED==="true"/);
 assert.match(route,/process\.env\.NMI_GATEWAY_MODE==="PRODUCTION"/);
 assert.match(route,/customerAuthConfigured\(\)/);
 assert.match(route,/authenticatedCustomer\(\)/);
 assert.match(route,/sameOrigin\(request\)/);
});
test("gateway request is permitted only after atomic enrollment admission and current-catalog server quote",()=>{
 const insert=route.indexOf("insert into litix_autolikes_enrollment_attempts");
 const post=route.indexOf('fetch("https://paykings.transactiongateway.com/api/transact.php"');
 assert.ok(insert>0&&post>insert);
 assert.match(route,/on conflict do nothing returning id/);
 assert.match(route,/if\(!admitted\.length\)return respond\(/);
 assert.match(route,/fetchLikesServices\(campaign\.platform\)/);
 assert.match(route,/quoteMonthlyAutoLikes\(/);
 assert.match(route,/where id=\$1 and customer_id=\$2/);
 assert.doesNotMatch(route,/smmglob\.com|action:["']add["']|ccnumber|ccexp/);
});
test("approved NMI subscription stays pending independent payment verification, ambiguous outcomes are never retried",()=>{
 assert.match(route,/GATEWAY_APPROVED_PENDING_VERIFICATION/);
 assert.match(route,/UNKNOWN_OUTCOME/);
 assert.match(route,/No automatic retry/);
 assert.match(route,/no automatic retry/i);
 assert.doesNotMatch(route,/set status=.+ACTIVE_PAID|setInterval|setTimeout\(/);
 assert.match(ledger,/unique\s*\(customer_id,campaign_id,request_key\)/);
 assert.match(ledger,/ALTER TABLE litix_autolikes_enrollment_attempts ENABLE ROW LEVEL SECURITY/i);
 assert.match(ledger,/litix_autolikes_one_active_enrollment_per_campaign/);
 assert.doesNotMatch(ledger,/payment_token|card_number|cvv/);
});
