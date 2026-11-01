import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SERVICE_NAV_GROUPS,allowedServiceFilter} from "../lib/serviceNavigation.mjs";
import {matchesServiceQuickKind} from "../lib/catalogSort.mjs";
import {litixKind,litixPlatform} from "../lib/litixServiceClassify.mjs";
import {filterBoosteroCards} from "../lib/boosteroCatalog.mjs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("navigation groups and service kinds are in owner-specified order",()=>{
 assert.deepEqual(SERVICE_NAV_GROUPS.map(x=>x.label),["TikTok","Instagram","YouTube","X","Facebook"]);
 assert.deepEqual(SERVICE_NAV_GROUPS.map(x=>x.kinds.map(y=>y.label)),[
  ["Followers","Likes","Views","Comments","Shares","Saves"],
  ["Followers","Likes","Views","Comments","Shares","Saves"],
  ["Subscribers","Likes","Views","Comments"],
  ["Likes","Views","Retweets","Followers"],
  ["Followers","Likes","Views"]
 ]);
 for(const group of SERVICE_NAV_GROUPS){
  assert.equal(allowedServiceFilter(group.platform,""),true);
  for(const kind of group.kinds)assert.equal(allowedServiceFilter(group.platform,kind.kind),true);
 }
 assert.equal(allowedServiceFilter("All platforms",""),true);
 assert.equal(allowedServiceFilter("YouTube","retweets"),false);
 assert.equal(allowedServiceFilter("TikTok","subscribers"),false);
});

test("X retweets and reposts classify independently from other Twitter/X services",()=>{
 for(const name of ["Twitter Retweets","Twitter USA Retweets","X Reposts","Twitter Repost"]){
  assert.equal(litixPlatform(name,"Twitter (X)"),"Twitter (X)");
  assert.equal(litixKind(name,"Twitter (X)"),"retweets");
  assert.equal(matchesServiceQuickKind({name,category:"Twitter (X)"},"retweets"),true);
  assert.equal(matchesServiceQuickKind({name,category:"Twitter (X)"},"views"),false);
 }
 assert.equal(litixKind("Instagram Reposts","Instagram"),"other");
});

test("Views, Likes, Followers and Subscribers filter to their explicit service title",()=>{
 const cases=[
  ["TikTok Views","views"],["Instagram Story Views","views"],
  ["YouTube Subscribers Active Accounts","subscribers"],
  ["YouTube Likes","likes"],["Twitter Views","views"],
  ["TikTok Followers","followers"],["Instagram Likes","likes"]
 ];
 for(const [name,kind] of cases){
  assert.equal(matchesServiceQuickKind({name,category:name},kind),true,name);
  for(const another of ["likes","views","followers","subscribers","retweets"]){
   if(another!==kind)assert.equal(matchesServiceQuickKind({name,category:name},another),false,name+" / "+another);
  }
 }
 // Wide supplier category labels cannot turn unrelated services into Views or Likes.
 assert.equal(matchesServiceQuickKind({name:"Twitter Space Listeners 5 Min",category:"Twitter Views"},"views"),false);
 assert.equal(matchesServiceQuickKind({name:"Instagram Likes and Views",category:"Instagram Likes"},"likes"),false);
 assert.equal(matchesServiceQuickKind({name:"Instagram Likes and Views",category:"Instagram Likes"},"views"),false);
 assert.equal(matchesServiceQuickKind({name:"YouTube Members",category:"YouTube Subscribers"},"subscribers"),false);
});

test("server catalog applies correct platform and type, not unrelated supplier categories",()=>{
 const cards=[
  {id:"boostero_1",name:"Twitter Retweets",category:"Twitter Retweets",platform:"Twitter (X)",kind:"retweets"},
  {id:"boostero_2",name:"Twitter Space Listeners",category:"Twitter Views",platform:"Twitter (X)",kind:"views"},
  {id:"boostero_3",name:"Twitter Views",category:"Twitter Views",platform:"Twitter (X)",kind:"views"},
  {id:"boostero_4",name:"YouTube Subscribers",category:"YouTube Subscribers",platform:"YouTube",kind:"subscribers"},
  {id:"boostero_5",name:"TikTok Views",category:"TikTok Views",platform:"TikTok",kind:"views"},
  {id:"boostero_6",name:"Instagram Views",category:"Instagram Views",platform:"Instagram",kind:"views"}
 ];
 const ids=q=>filterBoosteroCards(cards,new URLSearchParams(q)).map(x=>x.id);
 assert.deepEqual(ids("platform=Twitter+%28X%29&kind=retweets"),["boostero_1"]);
 assert.deepEqual(ids("platform=Twitter+%28X%29&kind=views"),["boostero_3"]);
 assert.deepEqual(ids("platform=YouTube&kind=subscribers"),["boostero_4"]);
 assert.deepEqual(ids("platform=TikTok&kind=views"),["boostero_5"]);
 assert.deepEqual(ids("platform=Instagram&kind=views"),["boostero_6"]);
 assert.deepEqual(ids("platform=YouTube&kind=retweets"),[]);
});

test("homepage shows compact AutoLikes instead of duplicating the service directory",()=>{
 const home=source("app/page.jsx");
 const servicesPage=source("app/services/page.jsx");
 const directory=source("components/LitixDirectory.jsx");
 const global=source("app/api/catalog/global/route.js");
 const css=source("app/metallic.css");
 const directoryCss=source("app/catalog.css");
 assert.match(home,/id="litix-autolikes-home-title"/);
 assert.match(home,/Automatic Likes for Your Next Posts/);
 assert.match(home,/href="\/autolikes">Explore Automatic Likes<\/a>/);
 assert.match(home,/href="\/services">Browse All Litix Services<\/a>/);
 assert.doesNotMatch(home,/<LitixDirectory\/>/);
 assert.doesNotMatch(home,/id="service-results"/);
 assert.doesNotMatch(home,/aria-label="Browse verified Litix services by platform"/);
 assert.doesNotMatch(home,/className="cards"/);
 assert.match(home,/id="checkout" className="panel sticky"/);
 // Preserve a selected service from the full catalog when the customer reaches checkout.
 assert.match(home,/new URLSearchParams\(location\.search\)\.get\("service"\)/);
 assert.match(home,/fetch\("\/api\/catalog\/v1\?q="/);
 assert.match(servicesPage,/<LitixDirectory standalone/);
 assert.match(directory,/SERVICE_NAV_GROUPS\.map\(group=>/);
 assert.match(directory,/onClick=\{\(\)=>selectFocus\(group\.platform,item\.kind\)\}/);
 assert.match(directory,/syncDirectoryFilterUrl/);
 assert.match(directory,/href=\{"\/\?service="\+encodeURIComponent\(s\.id\)\+"#checkout"\}/);
 assert.match(global,/matchesServiceQuickKind\(s,kind\)/);
 assert.match(global,/return "retweets"/);
 assert.match(css,/litix-service-group-grid/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(directoryCss,/litix-directory-filter-group/);
});
