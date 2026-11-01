import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/autolikes/page.jsx",import.meta.url),"utf8");
const storefront=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");
const catalog=readFileSync(new URL("../app/api/autolikes/catalog/route.js",import.meta.url),"utf8");
const enroll=readFileSync(new URL("../app/api/autolikes/enroll/route.js",import.meta.url),"utf8");
test("AutoLikes shows real native supplier choices, but no charge without recurring authorization",()=>{
 assert.match(page,/AutoLikes subscriptions/);
 assert.match(page,/\/api\/autolikes\/catalog/);
 assert.match(page,/\/api\/autolikes\/quote/);
 assert.match(page,/catalog\.checkoutEnabled&&publicKey/);
 assert.match(page,/Monthly enrollment is not accepting payments yet/);
 assert.match(catalog,/autoLikesRecurringCheckoutReady/);
 assert.match(enroll,/if\(!autoLikesRecurringCheckoutReady\(\)\|\|!boosteroProductionReady\(\)\)/);
 assert.match(enroll,/GATEWAY_APPROVED_PENDING_VERIFICATION/);
});
test("existing one-time checkout and AutoLikes navigation remain intact",()=>{
 assert.match(storefront,/<a href="\/autolikes">AutoLikes<\/a>/);
 assert.match(storefront,/id="checkout"/);
 assert.match(storefront,/\/api\/checkout\/v1/);
});
