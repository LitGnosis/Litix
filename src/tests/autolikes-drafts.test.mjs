import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/autolikes.mjs",import.meta.url),"utf8")
 .replace('import { priceCatalog, retailPer1000 } from "./pricing.mjs";','const priceCatalog=rows=>({items:rows.map(r=>({...r,pricedRetail:Number(r.rate)*5}))}); const retailPer1000=r=>r.pricedRetail;');
const mod=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const ig={service:33588,name:"Instagram HQ Likes 30 Days",category:"Instagram Likes",type:"Default",rate:"1.40",min:"100",max:"50000",pricedRetail:7,refill:true};
const tt={service:44551,name:"TikTok Likes",category:"TikTok Likes",type:"Default",rate:"1.50",min:"100",max:"50000",pricedRetail:7.5,refill:false};
test("profile targets accept public Instagram/TikTok handles and normalize direct profile URLs",()=>{
 assert.deepEqual(mod.parseProfileTarget("@testing.profile","instagram"),{ok:true,handle:"@testing.profile",profileUrl:"https://www.instagram.com/testing.profile/",platform:"instagram"});
 assert.equal(mod.parseProfileTarget("https://www.tiktok.com/@testing_user","tiktok").handle,"@testing_user");
 assert.equal(mod.parseProfileTarget("https://www.instagram.com/testingprofile/","instagram").ok,true);
});
test("reject post URLs, other domains, embedded credentials, and malformed usernames",()=>{
 for(const url of ["https://instagram.com/p/123/","https://instagram.com/reel/456","https://example.org/@username","https://instagram.com/testing.profile/?foo=bar","https://www.instagram.com/testing.profile/extra","user..name"]){
  assert.equal(mod.parseProfileTarget(url,"instagram").ok,false,url);
 }
 assert.equal(mod.parseProfileTarget("https://www.instagram.com/example/","tiktok").ok,false);
 assert.equal(mod.parseProfileTarget("@a","tiktok").ok,false);
});
test("supplier catalog list includes only real, standard Likes services for selected network",()=>{
 assert.equal(mod.isEligibleLikesService(ig,"instagram"),true);
 assert.equal(mod.isEligibleLikesService(tt,"tiktok"),true);
 assert.equal(mod.isEligibleLikesService({...ig,name:"Instagram Followers",category:"Instagram Followers"},"instagram"),false);
 assert.equal(mod.isEligibleLikesService({...tt,name:"TikTok Views",category:"TikTok Views"},"tiktok"),false);
 assert.equal(mod.isEligibleLikesService({...ig,type:"Custom Comments"},"instagram"),false);
});
test("validate full campaign draft against actual service quantities and platform",()=>{
 const good=mod.draftPayload({platform:"instagram",target:"@testing_profile",serviceId:"33588",quantityPerPost:1000,maxPostsPerMonth:10},[ig]);
 assert.equal(good.ok,true);
 assert.equal(good.oneTimeEstimateCents,700);
 assert.equal(good.profileUrl,"https://www.instagram.com/testing_profile/");
 assert.equal(mod.draftPayload({platform:"instagram",target:"@testing_profile",serviceId:"33588",quantityPerPost:1,maxPostsPerMonth:10},[ig]).ok,false);
 assert.equal(mod.draftPayload({platform:"instagram",target:"@testing_profile",serviceId:"33588",quantityPerPost:1000,maxPostsPerMonth:0},[ig]).ok,false);
 assert.equal(mod.draftPayload({platform:"instagram",target:"@testing_profile",serviceId:"9999",quantityPerPost:1000,maxPostsPerMonth:10},[ig]).ok,false);
});
test("supplier services are read only and vendor IDs are preserved",async()=>{
 const oldKey=process.env.SMMGLOB_API_KEY,oldFetch=globalThis.fetch;
 process.env.SMMGLOB_API_KEY="fake-test-key";
 let calls=0;
 globalThis.fetch=async(_url,opts)=>{
  calls++;
  const p=new URLSearchParams(opts.body);
  assert.equal(p.get("action"),"services");
  assert.equal(p.get("key"),"fake-test-key");
  return {ok:true,json:async()=>[ig,tt]};
 };
 try{
  const list=await mod.fetchLikesServices("instagram");
  assert.equal(list.length,1);
  assert.equal(list[0].service,ig.service);
  assert.equal(calls,1);
  const again=await mod.fetchLikesServices("tiktok");
  assert.equal(again[0].service,tt.service);
  assert.equal(calls,1);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;else process.env.SMMGLOB_API_KEY=oldKey}
});
test("draft API enforces server-side verified auth, exact origin, draft-only actions, and owner-scoped writes",()=>{
 const api=readFileSync(new URL("../app/api/account/autolikes/route.js",import.meta.url),"utf8");
 assert.match(api,/customerAuthConfigured\(\)/);
 assert.match(api,/authenticatedCustomer\(\)/);
 assert.match(api,/new URL\(origin\)\.origin===new URL\(req\.url\)\.origin/);
 assert.match(api,/customer_id=\$1/);
 assert.match(api,/customer_id=\$2/);
 assert.match(api,/status in \('draft','paused'\)/);
 assert.match(api,/on conflict\(id\) do nothing/);
 assert.match(api,/charged:false,fulfillmentTriggered:false/);
 assert.doesNotMatch(api,/action:\s*["']add["']/);
 assert.doesNotMatch(api,/NMI_SECURITY_KEY|PAYKINGS_SECRET|createSubscription\(/);
});
