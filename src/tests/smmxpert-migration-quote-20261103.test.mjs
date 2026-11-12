import test from "node:test";
import assert from "node:assert/strict";
import {smmxpertRateUsd,smmxpertDraftQuote,smmxpertActivationBlockers,SMMXPERT_ENDPOINT}
 from "../lib/smmxpertMigrationQuote.mjs";
const now=1793742000000;
const service={service:"15550",name:"Instagram Likes USA",category:"Instagram Likes",type:"Default",rate:"330.1965",min:100,max:1000000};
const approved=["15550"];
test("SMMXPERT endpoint stays pinned to the vendor official HTTPS API",()=>{
 assert.equal(SMMXPERT_ENDPOINT,"https://smmxpert.com/api/v2");
});
test("Account INR does NOT establish vendor service RATE currency",()=>{
 assert.throws(()=>smmxpertRateUsd(330.1965,{rateCurrency:"INR"}),/rate_currency_not_verified/);
 assert.throws(()=>smmxpertRateUsd(330.1965,{rateCurrency:"JPY",rateCurrencyVerified:true}),/unsupported_account_currency/);
 assert.throws(()=>smmxpertRateUsd(330.1965,{rateCurrency:"INR",rateCurrencyVerified:true}),/live_fx_unavailable/);
 assert.throws(()=>smmxpertRateUsd(330.1965,{rateCurrency:"INR",rateCurrencyVerified:true,fxUsdPerInr:0.01,fxVerifiedAt:now-16*60*1000,now}),/live_fx_unavailable/);
 const usd=smmxpertRateUsd(330.1965,{rateCurrency:"INR",rateCurrencyVerified:true,fxUsdPerInr:0.0105,fxVerifiedAt:now-12000,now});
 assert.equal(Math.round(usd*100),347);
 assert.equal(smmxpertRateUsd(3.47,{rateCurrency:"USD",rateCurrencyVerified:true}),3.47);
});
test("approved Default supplier IDs preserve Litix markup and per-1000 floors",()=>{
 const quote=smmxpertDraftQuote(service,1000,{
  approvedServiceIds:approved,requiredPlatform:"Instagram",requiredKind:"likes",
  accountCurrency:"INR",rateCurrency:"INR",rateCurrencyVerified:true,fxUsdPerInr:0.0105,fxVerifiedAt:now-8000,now
 });
 assert.equal(quote.provider,"smmxpert");
 assert.equal(quote.quantity,1000);
 assert.equal(quote.retailPer1000Cents,600);
 assert.equal(quote.retailTotalCents,600);
 assert.equal(quote.wholesaleTotalCents,347);
 assert.equal(quote.accountCurrency,"INR");
});
test("service mismatches and unapproved IDs cannot receive a customer quote",()=>{
 const base={accountCurrency:"USD",rateCurrency:"USD",rateCurrencyVerified:true,approvedServiceIds:approved,requiredPlatform:"Instagram",requiredKind:"likes"};
 assert.throws(()=>smmxpertDraftQuote({...service,type:"Subscriptions"},1000,base),/service_type_not_supported/);
 assert.throws(()=>smmxpertDraftQuote({...service,service:999},1000,base),/service_not_approved/);
 assert.throws(()=>smmxpertDraftQuote(service,1000,{...base,requiredPlatform:"TikTok"}),/service_category_mismatch/);
 assert.throws(()=>smmxpertDraftQuote(service,1000,{...base,requiredKind:"followers"}),/service_category_mismatch/);
 assert.throws(()=>smmxpertDraftQuote({...service,min:100,max:200},300,base),/invalid_quantity/);
 assert.throws(()=>smmxpertDraftQuote(service,0,base),/invalid_quantity/);
});
test("production switch stays BLOCKED until every operational safety gate is proven",()=>{
 const checks=smmxpertActivationBlockers({apiKeyPresent:false});
 assert.ok(checks.includes("apiKeyPresent"));
 assert.ok(checks.includes("idempotentDispatchImplemented"));
 assert.ok(checks.includes("historicalOrderIsolationVerified"));
 assert.ok(checks.includes("paidEndToEndTestVerified"));
 assert.equal(checks.length,11);
 assert.ok(checks.includes("walletFunded"));
 assert.ok(checks.includes("rateCurrencyVerified"));
 const ready=smmxpertActivationBlockers({
  apiKeyPresent:true,catalogReadVerified:true,balanceCurrencyVerified:true,walletFunded:true,rateCurrencyVerified:true,fxVerified:true,
  serviceIdsApproved:true,idempotentDispatchImplemented:true,historicalOrderIsolationVerified:true,
  trackingAndRefundsVerified:true,paidEndToEndTestVerified:true
 });
 assert.deepEqual(ready,[]);
});
