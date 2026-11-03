import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/autolikes/page.jsx",import.meta.url),"utf8");
const checkout=readFileSync(new URL("../app/api/autolikes/prepaid/checkout/route.js",import.meta.url),"utf8");
const storefront=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");
test("AutoLikes supports one-time prepaid future posts, not a recurring subscription",()=>{
 assert.match(page,/AutoLikes/);
 assert.match(page,/ONE-TIME PAYMENT/);
 assert.match(page,/\/api\/autolikes\/prepaid\/catalog/);
 assert.match(page,/\/api\/autolikes\/prepaid\/checkout/);
 assert.match(page,/posts.{0,12}10|up to 10 posts/i);
 assert.doesNotMatch(page,/recurringConsent|subscription checkout/i);
 assert.match(checkout,/type:"sale"/);
 assert.doesNotMatch(checkout,/add_subscription/);
});
test("AutoLikes is discoverable while existing production checkout stays intact",()=>{
 assert.match(storefront,/<a href="\/autolikes">AutoLikes<\/a>/);
 assert.match(storefront,/id="checkout"/);
 assert.match(storefront,/\/api\/checkout\/v1/);
});
