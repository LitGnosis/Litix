import test from "node:test";
import assert from "node:assert/strict";
import {
 validateAnalyticsCampaign,validateAnalyticsSnapshot,upsertAnalyticsCampaign,addAnalyticsSnapshot,
 analyticsSummary,analyticsCsv,restoreAnalytics,MAX_CAMPAIGNS
} from "../lib/platinumAnalyticsStudio.mjs";
const c={id:"campaign_12345678",name:"Litix Creator Launch",platform:"Instagram",goal:"Track reach and leads",snapshots:[]};
const s=(date,overrides={})=>({date,followers:1000,impressions:2000,views:1500,likes:200,comments:20,shares:10,clicks:100,leads:5,spendCents:1500,...overrides});
test("campaign validation enforces platform and safe optional URL",()=>{
 assert.equal(validateAnalyticsCampaign(c).ok,true);
 assert.equal(validateAnalyticsCampaign({...c,name:"a"}).ok,false);
 assert.equal(validateAnalyticsCampaign({...c,platform:"unlisted"}).ok,false);
 assert.equal(validateAnalyticsCampaign({...c,website:"http://localhost/internal"}).ok,false);
 assert.equal(validateAnalyticsCampaign({...c,website:"https://litix.net/"}).ok,true);
});
test("snapshot rejects malformed dates, unreasonable metrics, negative amounts and impossible clicks",()=>{
 assert.equal(validateAnalyticsSnapshot(s("2026-02-29")).ok,false);
 assert.equal(validateAnalyticsSnapshot(s("2026-10-27",{followers:-1})).ok,false);
 assert.equal(validateAnalyticsSnapshot(s("2026-10-27",{spendCents:10.2})).ok,false);
 assert.equal(validateAnalyticsSnapshot(s("2026-10-27",{impressions:20,clicks:100})).ok,false);
 assert.equal(validateAnalyticsSnapshot(s("2026-10-27")).ok,true);
});
test("metrics use cumulative latest snapshot, not sum of dashboard totals",()=>{
 const x=addAnalyticsSnapshot(addAnalyticsSnapshot(c,s("2026-10-26")),s("2026-10-28",{
  followers:1300,impressions:5000,likes:250,comments:30,shares:20,clicks:200,leads:10,spendCents:4000
 }));
 const m=analyticsSummary(x);
 assert.equal(m.impressions,5000);
 assert.equal(m.followers,1300);assert.equal(m.followerDelta,300);
 assert.equal(m.followersChangePercent,30);
 assert.equal(m.engagementPercent,6);
 assert.equal(m.clickThroughPercent,4);
 assert.equal(m.leadConversionPercent,5);
 assert.equal(m.costPerLeadUsd,4);
 assert.equal(m.snapshotCount,2);
 assert.equal(m.externallyVerified,false);
});
test("duplicate date safely replaces current snapshot and preserves sorted history",()=>{
 const x=addAnalyticsSnapshot(addAnalyticsSnapshot(c,s("2026-10-29")),s("2026-10-28"));
 const next=addAnalyticsSnapshot(x,s("2026-10-28",{followers:2500}));
 assert.deepEqual(next.snapshots.map(s=>s.date),["2026-10-28","2026-10-29"]);
 assert.equal(next.snapshots[0].followers,2500);assert.equal(next.snapshots.length,2);
});
test("stored data sanitizes extras, corrupt JSON, invalid and duplicate records",()=>{
 assert.deepEqual(restoreAnalytics("not-json"),[]);
 const a=restoreAnalytics(JSON.stringify([c,{...c,id:"bad",name:"hello"},
  {...c,id:"campaign_valid888",snapshots:[s("2026-10-28",{extra:"secret"}),s("2026-10-28",{followers:2000})]}]));
 assert.equal(a.length,2);
 assert.equal(a[1].snapshots.length,1);
 assert.equal(a[1].snapshots[0].extra,undefined);
});
test("campaign limit and no external verification claims",()=>{
 let campaigns=[];
 for(let i=0;i<MAX_CAMPAIGNS;i++)
  campaigns=upsertAnalyticsCampaign(campaigns,{...c,id:"campaign_"+String(i).padStart(8,"0")});
 assert.equal(campaigns.length,MAX_CAMPAIGNS);
 assert.throws(()=>upsertAnalyticsCampaign(campaigns,{...c,id:"campaign_extra999"}),/limit/);
 const metric=analyticsSummary(c);
 assert.equal(metric.hasData,false);
});
test("CSV export protects spreadsheet formula injection and never claims verified metrics",()=>{
 const x=addAnalyticsSnapshot({...c,name:"=HYPERLINK(\"bad\")"},s("2026-10-28"));
 const output=analyticsCsv([x]);
 assert.ok(output.startsWith("\uFEFF"));
 assert.ok(output.includes("'=HYPERLINK"));
 assert.ok(output.includes('"User entered","No"'));
 assert.doesNotMatch(output,/API verified|organic performance confirmed/);
});
