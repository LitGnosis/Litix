import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {LITIX_ADDITIONAL_SEO} from "../lib/litixAdditionalSeo.mjs";
import {verifiedSavingsDetails,curatedQuantityBadge} from "../lib/litixCuratedSavings.mjs";
import {proposedProratedCreditCents,assessSupplierRecovery} from "../lib/fulfillment/failover.mjs";

const source=path=>readFile(new URL(path,import.meta.url),"utf8");
test("SEO includes each platform with verified-safe category filtering",async()=>{
 const slugs=Object.keys(LITIX_ADDITIONAL_SEO);
 assert.equal(slugs.length,7);
 for(const p of ["Instagram","TikTok","YouTube","Twitter (X)"])
  assert.ok(Object.values(LITIX_ADDITIONAL_SEO).some(item=>item.platform===p),p);
 const page=await source("../app/[slug]/page.jsx");
 const sitemap=await source("../app/sitemap.js");
 assert.match(page,/generateStaticParams/);
 assert.match(page,/"@type":"FAQPage"/);
 assert.match(page,/"@type":"Product"/);
 assert.match(page,/initialPlatform=\{item.platform\}/);
 assert.match(sitemap,/Object.keys\(LITIX_ADDITIONAL_SEO\)/);
});
test("real savings details include verified dollar and percentage values",()=>{
 const cards=[
  {quantity:100,totalCents:200,available:true},
  {quantity:1000,totalCents:1800,available:true},
  {quantity:5000,totalCents:7500,available:true}
 ];
 assert.deepEqual(verifiedSavingsDetails(cards,1000),{savedCents:200,percent:10});
 assert.deepEqual(verifiedSavingsDetails(cards,5000),{savedCents:2500,percent:25});
 assert.equal(curatedQuantityBadge(cards,1000,{live:true}),"Save $2.00 (10%)");
 assert.equal(curatedQuantityBadge(cards,5000,{live:true}),"Save $25.00 (25%)");
 assert.equal(verifiedSavingsDetails(cards,2500),null);
});
test("recovery amounts are cents-exact and do not auto-repeat supplier orders",()=>{
 assert.equal(proposedProratedCreditCents({paidCents:1102,quantity:1000,remains:250}),276);
 assert.equal(proposedProratedCreditCents({paidCents:100,quantity:1,remains:2}),null);
 assert.equal(assessSupplierRecovery({state:"UNKNOWN_OUTCOME",quantity:1000,remains:1000,paidCents:1102}).action,"NONE");
 const review=assessSupplierRecovery({state:"PARTIAL",quantity:1000,remains:250,paidCents:1102,backupServiceId:"12345"});
 assert.equal(review.action,"MANUAL_REVIEW");
 assert.equal(review.creditCents,276);
 assert.equal(review.suggestedBackup,"12345");
});
test("new operations are protected and never call supplier add or refill",async()=>{
 const [monitor,cron,trial]=await Promise.all([
  source("../lib/boosteroMonitor.mjs"),
  source("../app/api/internal/boostero/monitor/route.js"),
  source("../app/api/free-trial/route.js")
 ]);
 assert.match(monitor,/payment_state='paid'/);
 assert.match(monitor,/FOR UPDATE OF f SKIP LOCKED/);
 assert.match(monitor,/operation\("status",\{orders:ids\}\)/);
 assert.doesNotMatch(monitor,/operation\("(?:add|refill)"/);
 assert.match(cron,/authorizedCron\(req\)/);
 assert.match(cron,/LITIX_BOOSTERO_MONITOR_V2_ENABLED/);
 assert.match(trial,/turnstile\(captcha,ip\)/);
 assert.match(trial,/litix_claim_free_trial/);
 assert.match(trial,/UNKNOWN_OUTCOME/);
});
test("expired Auto-Likes toggles and redundant checkout trust are absent",async()=>{
 const [page,premium,hero]=await Promise.all([
  source("../app/page.jsx"),source("../components/PremiumInlineCheckout.jsx"),
  source("../components/LitixQuickShop.jsx")]);
 assert.doesNotMatch(page,/Add 30-Day Auto-Likes \(currently unavailable\)/);
 assert.doesNotMatch(premium,/premium-checkout-security/);
 assert.doesNotMatch(hero,/litix-hero-proof/);
 assert.match(premium,/litix-checkout-trust/);
});
