import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GROWTH_CHANNELS,buildNativeGrowthKit,safeCampaignUrl,trackedCampaignUrl,weeklySalesRunRate} from "../lib/litixNativeGrowthEngine.mjs";

const raw={
 brand:"Litix",campaign:"Agency Ops",audience:"marketing agencies",pain:"missed customer inquiries",
 solution:"consent-based lead follow-up",cta:"Request a scoped review",landingUrl:"https://www.litix.net/agency-growth"
};
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("first-party content kit produces 12 distinct creative drafts without a publish API",()=>{
 const kit=buildNativeGrowthKit(raw);
 assert.equal(kit.variants.length,12);
 assert.equal(GROWTH_CHANNELS.length,4);
 assert.equal(new Set(kit.variants.map(v=>v.id)).size,12);
 assert.deepEqual(new Set(kit.variants.map(v=>v.angle)),new Set(["problem","process","questions"]));
 for(const v of kit.variants){
  assert.match(v.trackingUrl,/utm_source=/);
  assert.match(v.trackingUrl,/utm_medium=organic_social/);
  assert.match(v.trackingUrl,/utm_campaign=agency-ops/);
  assert.equal(v.published,false);
  assert.equal(v.videoRendered,false);
  assert.match(v.status,/DRAFT/);
  assert.ok(v.caption.includes(v.trackingUrl));
 }
});
test("campaign URL validation blocks unsafe and malformed destinations",()=>{
 for(const value of ["javascript:alert(1)","http://example.com","https://127.0.0.1/","https://localhost/","https://admin:pwd@example.com","not a url"])
  assert.equal(safeCampaignUrl(value),null);
 assert.throws(()=>buildNativeGrowthKit({...raw,landingUrl:"https://localhost"}));
 const link=new URL(trackedCampaignUrl("https://www.litix.net/agency-growth?ref=partner","tiktok","Agency Ops","process"));
 assert.equal(link.searchParams.get("ref"),"partner");
 assert.equal(link.searchParams.get("utm_content"),"process");
 assert.throws(()=>trackedCampaignUrl("https://www.litix.net","bad","agency","process"));
 assert.throws(()=>trackedCampaignUrl("https://www.litix.net","tiktok","agency","bad"));
});
test("missing details never create a misleading deliverable",()=>{
 assert.throws(()=>buildNativeGrowthKit({...raw,brand:""}));
 assert.throws(()=>buildNativeGrowthKit({...raw,cta:""}));
 assert.throws(()=>buildNativeGrowthKit({...raw,pain:"hi"}));
});
test("annualized weekly gross target is not called sales or net profit",()=>{
 const result=weeklySalesRunRate({weeklyGoal:10000,monthlyRetainer:4000,closeRate:20});
 assert.equal(result.clientsNeeded,11);
 assert.equal(result.monthlyGross,44000);
 assert.equal(result.qualifiedSalesCalls,55);
 assert.ok(result.weeklyGrossRunRate>10000);
 assert.equal(result.profitVerified,false);
 assert.throws(()=>weeklySalesRunRate({monthlyRetainer:0}));
});
test("studio is first-party and routes leads through existing manual proposal funnel",()=>{
 const page=file("app/growth-studio/page.jsx");
 const component=file("components/LitixGrowthStudio.jsx");
 const engine=file("lib/litixNativeGrowthEngine.mjs");
 assert.match(page,/LitixGrowthStudio/);
 assert.match(component,/\/agency-growth\?offer=marketing-ops#request/);
 assert.match(component,/No Butter subscription/);
 assert.doesNotMatch(engine,/api\.resend\.com|boostero.*placeOrder/);
 assert.match(component,/Not posted, recorded, scheduled, sold or delivered/);
});
