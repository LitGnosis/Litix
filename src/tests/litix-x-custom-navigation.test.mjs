import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {customPlatformFromQuery,quickShopCustomHref,eligibleXFollowers,preferredXFollowers} from "../lib/litixXCustomRouting.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const follower=(id,name,extra={})=>({id:"litix_"+id,platform:"Twitter (X)",kind:"followers",name,per1000:18,min:100,max:100000,unitStep:1,purchasable:true,...extra});

test("X homepage Custom Likes & Followers remembers selected X tab",()=>{
 assert.equal(quickShopCustomHref("X"),"/custom-likes?platform=x&kind=followers");
 assert.equal(quickShopCustomHref("TikTok"),"/custom-likes?platform=tiktok");
 assert.equal(quickShopCustomHref("Instagram"),"/custom-likes?platform=instagram");
 assert.equal(customPlatformFromQuery("x"),"Twitter (X)");
 assert.equal(customPlatformFromQuery("Twitter (X)"),"Twitter (X)");
 assert.equal(customPlatformFromQuery("javascript:alert(1)"),null);
 const quick=read("components/LitixQuickShop.jsx");
 assert.match(quick,/href=\{quickShopCustomHref\(platform\)\}/);
 const hub=read("components/LitixCustomHub.jsx");
 assert.match(hub,/customPlatformFromQuery\(p\.get\("platform"\)\)/);
 assert.match(hub,/if\(value==="Twitter \(X\)"\)setKind\("followers"\)/);
 assert.match(hub,/X Custom Followers/);
});
test("X follower choices use live-approved catalog and never fake availability",()=>{
 const rows=[
  follower(1408,"Twitter NFT Followers",{per1000:5.04}),
  follower(581,"Twitter USA Followers",{per1000:17.01}),
  follower(700,"Twitter Regular Followers",{per1000:9.2}),
  follower(999,"Twitter Other",{purchasable:false}),
  follower(500,"Twitter Likes",{kind:"likes"}),
  follower(401,"Twitter Bad",{id:"boostero_401"}),
  follower(402,"Twitter Invalid",{min:0})
 ];
 assert.deepEqual(eligibleXFollowers(rows).map(x=>x.id),["litix_1408","litix_581","litix_700"]);
 assert.equal(preferredXFollowers(rows)?.id,"litix_581");
 assert.equal(preferredXFollowers([rows[0],rows[2]])?.id,"litix_700");
 assert.equal(preferredXFollowers([rows[0]])?.id,"litix_1408");
 assert.equal(preferredXFollowers([]),null);
 const hub=read("components/LitixCustomHub.jsx");
 assert.match(hub,/preferredXFollowers\(eligible\)/);
 assert.match(hub,/setXFollowerServices\(eligibleXFollowers\(eligible\)\)/);
 assert.match(hub,/value=\{liveService\.id\}/);
 assert.match(hub,/customProductLink\(product,liveService\?\.id\)/);
});
test("X uses existing secure checkout and does not alter IG/TK multi-post contracts",()=>{
 const hub=read("components/LitixCustomHub.jsx");
 assert.match(hub,/kind==="followers"&&quote\.valid/);
 assert.match(hub,/&quantity=/);
 assert.match(hub,/kind==="likes"\?\[newTikTokPost/);
 assert.match(hub,/SocialMultiPostChooser/);
 assert.match(hub,/CUSTOM_DRAFT_PREFIX\+id/);
 const home=read("app/page.jsx");
 assert.match(home,/\/api\/catalog\/v1\?q=/);
 assert.match(home,/\/api\/checkout\/v1/);
 assert.match(home,/\["litix_4751","litix_5251"\]\.includes\(requested\)/);
});
