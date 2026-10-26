import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const paykings=read("app/api/autolikes/paykings/route.js");
const supplier=read("lib/liveAutoLikes.mjs");
const checkout=read("app/account/AutoLikesCheckout.jsx");

test("NMI gateway signature verifies nonce and raw bytes, not signup webhook format",()=>{
 assert.match(paykings,/webhook-signature/);
 assert.match(paykings,/match\[1\]\+"\."\+raw/);
 assert.match(paykings,/timingSafeEqual/);
 assert.doesNotMatch(paykings,/req\.headers\.get\("signature"\)/);
});

test("SMMGLOB is the only supplier and no preview environment can place live supplier orders",()=>{
 assert.match(supplier,/supplier:"SMMGLOB"/);
 assert.match(supplier,/SMMGLOB_API_KEY/);
 assert.doesNotMatch(supplier,/smmfollowom|SMMFOLLOWOM/i);
 assert.match(supplier,/VERCEL_ENV!=="production"/);
 assert.match(supplier,/LITIX_AUTOLIKES_DISPATCH_ENABLED/);
 assert.match(supplier,/UNKNOWN_OUTCOME/);
});

test("Collect.js submit and token callback use one-way idempotent enrollment lock",()=>{
 assert.match(checkout,/startPaymentRequest\(\)/);
 assert.match(checkout,/enrollmentSubmitted\.current=true/);
 assert.match(checkout,/if\(enrollmentSubmitted\.current\|\|!consent/);
 assert.doesNotMatch(checkout,/if\(busy\|\|!consent\|\|!config/);
});
