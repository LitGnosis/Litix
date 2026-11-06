import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {creatorEmail,creatorSignupInput,ownerTokenAuthorized,creatorHash} from "../lib/creatorFunnel.mjs";

test("creator signup requires real-looking email and explicit single-email consent",()=>{
 assert.equal(creatorEmail("  New.Creator@IndieAgency.co  "),"new.creator@indieagency.co");
 for(const email of ["hello@example.com","lead@test.com","asdf@indieagency.co","invalid","test@localhost","a@b.test"]){
  assert.equal(creatorEmail(email),null,email);
 }
 assert.equal(creatorSignupInput({email:"creator@indieagency.co",consent:false}).ok,false);
 assert.equal(creatorSignupInput({email:"creator@indieagency.co",consent:true,websiteTrap:"junk"}).spam,true);
});
test("untrusted attribution is strictly reduced to safe source tokens",()=>{
 const got=creatorSignupInput({email:"creator@indieagency.co",consent:true,attribution:{
  utm_source:" Instagram ",utm_medium:"DM",utm_campaign:"LAUNCH2026",utm_content:"link",
  ref:"a".repeat(24),customer_email:"victim@site.com",utm_term:"bad"}});
 assert.equal(got.ok,true);
 assert.deepEqual(got.data.attribution,{utm_source:"instagram",utm_medium:"dm",utm_campaign:"launch2026",utm_content:"link",ref:"a".repeat(24)});
 assert.equal(creatorSignupInput({email:"creator@indieagency.co",consent:true,attribution:{ref:"../admin"}}).data.attribution.ref,undefined);
});
test("owner access uses constant time secret hash comparison",()=>{
 const secret="topsecret".repeat(6);
 const req=value=>({headers:{get:()=>value}});
 assert.equal(ownerTokenAuthorized(req("Bearer "+secret),secret),true);
 assert.equal(ownerTokenAuthorized(req("Bearer something-else"),secret),false);
 assert.equal(ownerTokenAuthorized(req("Bearer "+secret),"short"),false);
 assert.equal(creatorHash("alpha").length,64);
});
test("source routes preserve payment/fulfillment boundaries and require explicit enabled signup",async()=>{
 const read=p=>readFile(new URL(p,import.meta.url),"utf8");
 const [post,confirm,affiliate,ref,metrics,home,ui,migration]=await Promise.all([
  read("../app/api/creator-signup/route.js"),read("../app/api/creator-signup/confirm/route.js"),
  read("../app/api/affiliates/route.js"),read("../app/r/[code]/route.js"),
  read("../app/api/creator-signup/metrics/route.js"),read("../app/page.jsx"),
  read("../components/CreatorPlanSignup.jsx"),read("../db/migrations/20261105-creator-signup-affiliate.sql")
 ]);
 assert.match(post,/LITIX_CREATOR_SIGNUP_ENABLED/);
 assert.match(post,/12 hours/);
 assert.match(post,/on conflict\(email\)/);
 assert.match(post,/Idempotency-Key/);
 assert.match(post,/resend\.com/);
 assert.match(confirm,/confirm_expires_at>now\(\)/);
 assert.match(affiliate,/ownerTokenAuthorized/);
 assert.match(affiliate,/needsApproval:true/);
 assert.match(affiliate,/paidPayoutsEnabled:false/);
 assert.match(ref,/where code=\$1 and active=true/);
 assert.match(ref,/utm_source/);
 assert.match(metrics,/salesAttribution:false/);
 assert.match(home,/CreatorPlanSignup/);
 assert.match(ui,/consent/);
 assert.match(ui,/No account is created/);
 assert.match(migration,/litix_creator_signups/);
 assert.match(migration,/litix_affiliate_partners/);
 for(const src of [post,confirm,affiliate,ref,metrics,migration]){
  assert.doesNotMatch(src,/boosteroProduction|dispatchBoostero|NMI_SECURITY_KEY|paymentToken|chargeCard/i);
 }
});
