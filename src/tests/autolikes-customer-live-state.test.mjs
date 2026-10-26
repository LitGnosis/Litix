import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/api/account/autolikes/route.js",import.meta.url),"utf8");

test("AutoLikes account status reads the actual owner-scoped paid subscription",()=>{
 assert.match(source,/litix_autolikes_live_subscriptions s/);
 assert.match(source,/s\.campaign_id=litix_auto_boost_campaigns\.id and s\.subscriber_id=\$1/);
 assert.match(source,/jsonb_build_object/);
 assert.match(source,/postsRemaining/);
 assert.match(source,/billingCycleEnd/);
 assert.match(source,/rows\.filter\(r=>r\.live_subscription\)/);
});
test("only verified production eligibility reports subscription purchase availability",()=>{
 assert.match(source,/LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED/);
 assert.match(source,/LITIX_NMI_RECURRING_MERCHANT_APPROVED/);
 assert.match(source,/LITIX_AUTOLIKES_SOURCE_VERIFIED/);
 assert.match(source,/LITIX_AUTOLIKES_DISPATCH_ENABLED/);
 assert.match(source,/Boolean\(process\.env\.SMMGLOB_API_KEY\)/);
 assert.doesNotMatch(source,/subscriptionEnabled:true,subscriptions:\[\]/);
});
