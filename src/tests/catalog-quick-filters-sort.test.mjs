import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {matchesServiceQuickKind,sortServicesPer1000} from "../lib/catalogSort.mjs";
const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const rank=x=>x.platform==="Instagram"?0:x.platform==="TikTok"?1:2;
test("numeric per-1000 retail ascending, independent of service ID and minimum checkout",()=>{
 const data=[
  {service:2,name:"Instagram Followers C",platform:"Instagram",retail:13.99,minimumOrder:1.00},
  {service:1,name:"Instagram Followers A",platform:"Instagram",retail:6.99,minimumOrder:2.00},
  {service:222,name:"Instagram Followers B",platform:"Instagram",retail:10.49,minimumOrder:1.00},
  {service:78,name:"TikTok Likes X",platform:"TikTok",retail:22.99},
  {service:18,name:"TikTok Likes Y",platform:"TikTok",retail:7.49},
 ];
 assert.deepEqual(sortServicesPer1000(data,rank,x=>x.retail).map(s=>s.service),[1,222,2,18,78]);
 assert.equal(data[0].service,2,"sorting should never mutate cached supplier order");
});
test("strict Instagram and TikTok Likes filtering excludes Followers and other service kinds",()=>{
 const input=[
  {name:"Instagram Likes Fast",category:"Instagram Likes"},
  {name:"Instagram Followers High Speed",category:"Instagram Followers"},
  {name:"TikTok Likes Premium",category:"TikTok Likes"},
  {name:"TikTok Shares",category:"TikTok Shares"},
  {name:"Instagram Likes and Views",category:"Instagram Likes"},
 ];
 const likes=input.filter(s=>matchesServiceQuickKind(s,"likes"));
 assert.deepEqual(likes.map(s=>s.name),["Instagram Likes Fast","TikTok Likes Premium"]);
 assert.deepEqual(input.filter(s=>matchesServiceQuickKind(s,"followers")).map(s=>s.name),["Instagram Followers High Speed"]);
});
test("frontend has seven interactive, visibly highlighted quick filters, backend handles kind",()=>{
 const home=src("app/page.jsx");
 const route=src("app/api/[action]/route.js");
 assert.match(home,/kinds|Followers","Likes"/);
 assert.match(home,/aria-pressed=\{platform===v&&quickKind===k.toLowerCase\(\)\}/);
 assert.match(home,/setQuickKind\(k.toLowerCase\(\)\)/);
 assert.match(home,/kind:quickKind/);
 assert.match(home,/quickKind,catalogRetry/);
 assert.match(route,/matchesServiceQuickKind\(x,quickKind\)/);
 assert.match(route,/sortServicesPer1000\(all.filter/);
 assert.match(route,/platformRank,retailPer1000/);
 const css=src("app/metallic.css");
 assert.match(css,/litix-network-tabs\{display:flex;flex-wrap:wrap/);
});
test("original checkout and retail price rules stay in place",()=>{
 const api=src("app/api/[action]/route.js");
 assert.match(api,/validateCheckoutQuote/);
 assert.match(api,/retailPer1000\(service\)\*qty\/1000/);
 assert.match(api,/smm\("add"/);
});
