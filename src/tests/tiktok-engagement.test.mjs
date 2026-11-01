import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {engagementSnapshot,engagementCsv} from "../lib/tiktokEngagement.mjs";
test("engagement uses transparent video and follower denominators",()=>{
 const r=engagementSnapshot({views:1000,likes:100,comments:10,shares:5,saves:5,followers:2000});
 assert.equal(r.interactions,120);
 assert.equal(r.byViews,12);
 assert.equal(r.byFollowers,6);
});
test("unknown denominators stay unavailable instead of invented",()=>{
 const r=engagementSnapshot({views:0,likes:50,followers:0});
 assert.equal(r.byViews,null);
 assert.equal(r.byFollowers,null);
});
test("invalid/negative/noninteger counts are rejected",()=>{
 for(const count of [-1,1.5,Number.POSITIVE_INFINITY,Number.NaN,1e14])
  assert.throws(()=>engagementSnapshot({views:count}),RangeError);
});
test("CSV is stable and quotes all cells",()=>{
 const csv=engagementCsv([engagementSnapshot({views:1000,likes:10})]);
 assert.match(csv,/recordedAt,views,likes,comments,shares,saves,followers,interactions,byViews,byFollowers/);
 assert.match(csv,/"1000","10","0","0","0","0","10","1",""/);
});
test("site connects the tool without data collection, supplier API or checkout",()=>{
 const page=readFileSync(new URL("../app/tools/tiktok-engagement/page.jsx",import.meta.url),"utf8");
 const shop=readFileSync(new URL("../app/shop/page.jsx",import.meta.url),"utf8");
 assert.match(page,/engagementSnapshot/);
 assert.match(page,/Export CSV/);
 assert.doesNotMatch(page,/fetch\(|BOOSTERO_API|startPaymentRequest|operation\("add"/i);
 assert.match(shop,/href="\/tools\/tiktok-engagement"/);
});
