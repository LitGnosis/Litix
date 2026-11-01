import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCheckoutChoices,checkoutKindLabel} from "../lib/litixCheckoutChoices.mjs";
import {profilePlatformForService,normalizeProfileDestination,checkoutProfilePlaceholder} from "../lib/litixOrderTarget.mjs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const s=(id,platform,kind,name,per1000=9)=>({
 id:"boostero_"+id,platform,kind,name,category:platform+" "+kind,
 min:50,max:10000,unitStep:1,per1000,startingAmountCents:100,purchasable:true,
 supplier:"PRIVATE_PROVIDER",wholesale:"KEEP_SECRET",supplierMin:50
});

test("platform dropdown prioritizes Instagram and TikTok then other available networks",()=>{
 const c=buildCheckoutChoices([
  s(7,"Facebook","likes","Facebook Likes"),
  s(2,"TikTok","followers","TikTok Followers"),
  s(8,"Twitter (X)","retweets","X Retweets"),
  s(1,"Instagram","followers","Instagram Followers"),
  s(4,"YouTube","subscribers","YouTube Subscribers"),
  s(9,"Spotify","plays","Spotify Plays")
 ]);
 assert.deepEqual(c.platforms.map(p=>p.name),["Instagram","TikTok","YouTube","Facebook","Twitter (X)","Spotify"]);
 assert.equal(c.platform,"Instagram");
 assert.equal(c.items.length,1);
 assert.equal(buildCheckoutChoices([s(2,"TikTok","followers","TikTok Followers")],"TikTok").platform,"TikTok");
});
test("followers and likes are the first service types, with live prices and no provider secrets",()=>{
 const rows=[
  s(5,"Instagram","views","Instagram Views"),
  s(3,"Instagram","likes","Instagram Likes"),
  s(4,"Instagram","followers","Instagram USA Followers",12),
  s(6,"Instagram","followers","Instagram Followers",9),
  {...s(9,"Instagram","likes","Inactive Likes"),purchasable:false}
 ];
 const c=buildCheckoutChoices(rows,"Instagram");
 assert.deepEqual(c.kinds.map(k=>k.value),["followers","likes","views"]);
 assert.deepEqual(c.kinds.map(k=>k.count),[2,1,1]);
 assert.equal(c.items.length,4);
 assert.equal(c.items[0].name,"Instagram USA Followers");
 assert.equal(checkoutKindLabel("saves"),"Saves");
 const serialized=JSON.stringify(c);
 assert.doesNotMatch(serialized,/PRIVATE_PROVIDER|KEEP_SECRET|supplierMin|Boostero|SMMGLOB/);
 assert.match(serialized,/litix_4/);
 assert.doesNotMatch(serialized,/boostero_4/);
});
test("followers and subscribers take page or username, likes take post URLs",()=>{
 assert.equal(profilePlatformForService({platform:"Instagram",kind:"followers"}),"instagram");
 assert.equal(profilePlatformForService({platform:"TikTok",kind:"followers"}),"tiktok");
 assert.equal(profilePlatformForService({platform:"Facebook",kind:"followers"}),"facebook");
 assert.equal(profilePlatformForService({platform:"YouTube",kind:"subscribers"}),"youtube");
 assert.equal(profilePlatformForService({platform:"Twitter (X)",kind:"followers"}),"x");
 assert.equal(profilePlatformForService({platform:"Instagram",kind:"likes"}),"");
 assert.equal(normalizeProfileDestination("@litixsocial","instagram").url,"https://www.instagram.com/litixsocial/");
 assert.equal(normalizeProfileDestination("@litixsocial","tiktok").url,"https://www.tiktok.com/@litixsocial");
 assert.equal(normalizeProfileDestination("@litixsocial","youtube").url,"https://www.youtube.com/@litixsocial");
 assert.equal(normalizeProfileDestination("@litixsocial","x").url,"https://x.com/litixsocial");
 assert.equal(normalizeProfileDestination("https://www.facebook.com/litixsocial","facebook").ok,true);
 assert.equal(normalizeProfileDestination("https://www.instagram.com/p/POSTID/","instagram").ok,false);
 assert.equal(normalizeProfileDestination("http://www.instagram.com/litixsocial","instagram").ok,false);
 assert.equal(normalizeProfileDestination("https://evil.example/litixsocial","instagram").ok,false);
 assert.match(checkoutProfilePlaceholder("facebook"),/facebook.com/);
});
test("homepage checkout has functional cascading dropdowns and retains live PayKings path",()=>{
 const home=source("app/page.jsx");
 const picker=source("components/LitixCheckoutSelector.jsx");
 const catalog=source("app/api/catalog/checkout-choices/route.js");
 const services=source("app/services/page.jsx");
 const css=source("app/quick-checkout.css");
 assert.match(home,/LitixCheckoutSelector selected=\{selected\} onChoose=/);
 assert.doesNotMatch(home,/Service<input readOnly/);
 assert.match(home,/fetch\("\/api\/catalog\/v1\?q="/);
 assert.match(home,/fetch\("\/api\/checkout\/v1"/);
 assert.match(home,/id="checkout" className="panel sticky"/);
 assert.match(home,/href="\/autolikes">Explore Automatic Likes/);
 for(const id of ["litix-platform","litix-service-kind","litix-service-choice"]){
  assert.match(picker,new RegExp(id));
 }
 assert.match(picker,/onChoose\(service\|\|null\)/);
 assert.match(picker,/\/api\/catalog\/checkout-choices\?/);
 assert.match(catalog,/buildCheckoutChoices\(snapshot\.items,requested\)/);
 assert.doesNotMatch(catalog,/key:process\.env|supplierServiceId\s*:/i);
 assert.match(services,/<LitixDirectory standalone/);
 assert.match(css,/@media\(max-width:660px\)/);
});
