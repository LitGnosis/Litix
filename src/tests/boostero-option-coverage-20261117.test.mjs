import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {litixPlatform,litixKind} from "../lib/litixServiceClassify.mjs";
import {matchesServiceQuickKind} from "../lib/catalogSort.mjs";
import {allowedServiceFilter} from "../lib/serviceNavigation.mjs";

test("Boostero broad category never overrides the individual service title",()=>{
 const category="Threads - Followers / Likes / Views / Reposts / Comments";
 for(const [title,kind] of [
  ["Threads Likes","likes"],
  ["Threads Views","views"],
  ["Threads Random Comments","comments"],
  ["Threads Followers","followers"],
  ["Threads Reposts","other"]
 ]){
  assert.equal(litixPlatform(title,category),"Threads");
  assert.equal(litixKind(title,category),kind,title);
 }
 assert.equal(litixKind("Twitter Space Listeners 5 Min","Twitter Views"),"listeners");
 assert.equal(litixKind("Instagram Likes and Views","Instagram - Likes"),"other");
 assert.equal(litixKind("Instagram Reposts","Instagram"),"other");
});

test("previously misfiled Boostero platforms are recognized",()=>{
 const services=[
  ["SoundCloud Plays","SoundCloud"],["Shopee Followers","Shopee"],
  ["Quora Views","Quora"],["VK.com Likes","VK"],
  ["Bluesky Followers","Bluesky"],["Tumblr Likes","Tumblr"],
  ["Truth Social Followers","Truth Social"],["Rumble Views","Rumble"],
  ["GitHub Stars","GitHub"],["Medium Views","Medium"],
  ["Clubhouse Followers","Clubhouse"],["CoinMarketCap Votes","CoinMarketCap"],
  ["Threads Likes","Threads"]
 ];
 for(const [title,platform] of services){
  assert.equal(litixPlatform(title,platform+" - Services"),platform,title);
  assert.equal(allowedServiceFilter(platform,""),true,platform);
 }
});

test("verified catalog filters work for members, plays, listeners, traffic and other",()=>{
 for(const [name,kind] of [
  ["Telegram Members","members"],["SoundCloud Plays","plays"],
  ["Twitter Space Listeners","listeners"],["Website Traffic","traffic"],
  ["Website Visits","traffic"]
 ]){
  assert.equal(litixKind(name,name),kind,name);
  assert.equal(matchesServiceQuickKind({name,category:name},kind),true,name);
 }
 assert.equal(matchesServiceQuickKind({name:"SoundCloud Playlist Add",category:"SoundCloud"}, "other"),true);
 assert.equal(allowedServiceFilter("Spotify","plays"),true);
 assert.equal(allowedServiceFilter("YouTube","retweets"),false);
 assert.equal(allowedServiceFilter("TikTok","subscribers"),false);
});

test("directory uses supplier-verified network/type options, not invented catalog cards",async()=>{
 const [route,component]=await Promise.all([
  readFile(new URL("../app/api/catalog/global/route.js",import.meta.url),"utf8"),
  readFile(new URL("../components/LitixDirectory.jsx",import.meta.url),"utf8")
 ]);
 assert.match(route,/platformKinds:data\.platformKinds/);
 assert.match(route,/kindsByPlatform/);
 assert.match(route,/filter\(s=>s\.purchasable===true\)/);
 assert.match(component,/Array\.isArray\(body\.platformKinds\)/);
 assert.match(component,/allowedServiceFilter\(group\.name,item\.kind\)/);
 assert.match(component,/className="litix-directory-advanced"/);
 assert.match(component,/href=\{"\/\?service="\+encodeURIComponent\(s\.id\)/);
});
