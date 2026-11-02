import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LITIX_CUSTOM_QUICK_PICKS,litixPreferredCustomService} from "../lib/litixCustomQuickPick.mjs";
import {normalizeProfileDestination,profilePlatformForService} from "../lib/litixOrderTarget.mjs";
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const card=(id,platform,kind,name,per1000)=>({
 id:"litix_"+id,platform,kind,name,per1000,min:kind==="likes"?167:112,
 max:100000,unitStep:1,purchasable:true
});
test("four top custom options lead to currently approved Litix Likes/Followers packages",()=>{
 const rows=[
  card(2132,"Instagram","followers","Instagram USA Followers",11.6),
  card(5461,"Instagram","followers","Instagram Followers",9),
  card(4367,"Instagram","likes","Instagram USA Likes",6),
  card(4751,"Instagram","likes","Instagram Likes",6),
  card(4971,"TikTok","followers","TikTok USA Followers",35.19),
  card(5101,"TikTok","followers","TikTok Followers",9),
  card(4966,"TikTok","likes","TikTok USA Likes",11.6),
  card(5251,"TikTok","likes","TikTok Likes",6)
 ];
 assert.deepEqual(LITIX_CUSTOM_QUICK_PICKS.map(x=>x.platform+" "+x.kind),[
  "Instagram followers","Instagram likes","TikTok followers","TikTok likes"
 ]);
 assert.deepEqual(LITIX_CUSTOM_QUICK_PICKS.map(x=>litixPreferredCustomService(rows,x.platform,x.kind)?.id),
  ["litix_5461","litix_4751","litix_5101","litix_5251"]);
 assert.equal(litixPreferredCustomService(rows.filter(r=>r.id!=="litix_4751"),"Instagram","likes")?.id,"litix_4367");
 assert.equal(litixPreferredCustomService(rows.map(r=>({...r,purchasable:false})),"TikTok","followers"),null);
});
test("followers accept a public profile; likes require a post URL",()=>{
 assert.equal(profilePlatformForService({platform:"Instagram",kind:"followers"}),"instagram");
 assert.equal(profilePlatformForService({platform:"TikTok",kind:"followers"}),"tiktok");
 assert.equal(profilePlatformForService({platform:"Instagram",kind:"likes"}),"");
 assert.equal(normalizeProfileDestination("@litixsocial","instagram").url,"https://www.instagram.com/litixsocial/");
 assert.equal(normalizeProfileDestination("@litixsocial","tiktok").url,"https://www.tiktok.com/@litixsocial");
 assert.equal(normalizeProfileDestination("https://www.instagram.com/p/FakePostCode","instagram").ok,false);
});
test("empty checkout never shows a misleading $0 charge or required URL field",()=>{
 const homepage=file("app/page.jsx");
 assert.match(homepage,/LitixCheckoutSelector selected=\{selected\}/);
 assert.match(homepage,/\{selected\?<>\{selected&&/);
 assert.match(homepage,/Choose Custom Followers or Custom Likes above to begin/);
 assert.match(homepage,/setMultiPostEnabled\(false\)/);
 assert.doesNotMatch(homepage,/setMultiPostEnabled\(choose\)/);
 assert.match(homepage,/\/api\/checkout\/v1/);
 assert.match(homepage,/normalizeProfileDestination\(link/);
 assert.match(homepage,/socialPlatform\?checkoutProfileLabel/);
 assert.match(homepage,/tiktokLikes\?.*"One video"/);
});
test("mobile custom buttons pick real live services; post chooser remains opt-in",()=>{
 const picker=file("components/LitixCheckoutSelector.jsx");
 const styles=file("app/quick-checkout.css");
 assert.match(picker,/LITIX_CUSTOM_QUICK_PICKS\.map/);
 assert.match(picker,/onClick=\{\(\)=>chooseCustom\(choice\.platform,choice\.kind\)\}/);
 assert.match(picker,/onChoose\(litixPreferredCustomService\(data\.items,platform,value\)\)/);
 assert.match(picker,/pendingIntent\.current/);
 assert.match(picker,/aria-pressed=\{selected\?\.platform/);
 assert.match(styles,/\.litix-custom-pick\[aria-pressed="true"\]/);
 assert.match(styles,/min-height:54px/);
 assert.match(file("app/api/catalog/checkout-choices/route.js"),/buildCheckoutChoices\(snapshot\.items,requested\)/);
});
