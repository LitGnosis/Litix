import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sortServicesPer1000} from "../lib/catalogSort.mjs";

const service = (id,category,per1000,extra={})=>({id,name:category,category,per1000,...extra});
const retail = s=>s.per1000;
test("Custom Orders ranks Instagram Followers → Instagram Likes → TikTok Followers → TikTok Likes → all others",()=>{
  const rows=[
    service("youtube-1","YouTube Views",1.25),
    service("tl-exp","TikTok Likes",14.5),
    service("if-exp","Instagram Followers",19),
    service("ti-exp","TikTok Followers",20),
    service("il-exp","Instagram Likes",11.1),
    service("if-low","Instagram Followers","5.99"),
    service("tl-low","TikTok Likes",4.99),
    service("ti-low","TikTok Followers",8.9),
    service("il-low","Instagram Likes",7.05),
    service("other-2","Facebook Likes",2.5),
  ];
  const copy=structuredClone(rows);
  assert.deepEqual(sortServicesPer1000(rows,null,retail).map(x=>x.id),
    ["if-low","if-exp","il-low","il-exp","ti-low","ti-exp","tl-low","tl-exp","youtube-1","other-2"]);
  assert.deepEqual(rows,copy,"sorting must not mutate the supplier catalog");
});
test("prices compare numerically, not alphabetically or by supplier service ID / starting order amount",()=>{
 const data=[
  service("boostero_1000","Instagram Followers",10,{startingAmountCents:500}),
  service("boostero_2","Instagram Followers",2.5,{startingAmountCents:10000}),
  service("boostero_7","Instagram Followers","9.50",{startingAmountCents:1500}),
  service("boostero_3","Instagram Followers",2.5,{startingAmountCents:900}),
 ];
 assert.deepEqual(sortServicesPer1000(data,null,retail).map(x=>x.id),["boostero_2","boostero_3","boostero_7","boostero_1000"]);
});
test("stable ordering survives refreshed supplier responses and malformed rates sort last within tier",()=>{
 const rows=[service("ig-a","Instagram Likes","n/a"),service("ig-b","Instagram Likes",6.99),
             service("ig-c","Instagram Likes",6.99),service("ig-d","Instagram Likes",16.99)];
 assert.deepEqual(sortServicesPer1000(rows,null,retail).map(x=>x.id),["ig-b","ig-c","ig-d","ig-a"]);
 assert.deepEqual(sortServicesPer1000(rows.slice().reverse(),null,retail).map(x=>x.id),["ig-c","ig-b","ig-d","ig-a"]);
});
test("US geo text does not override four-category priority; blended and unrelated services remain afterwards",()=>{
 const rows=[
  service("am-ig-like","Instagram Likes",9,{name:"US 🇺🇸 American Instagram Likes"}),
  service("ig-follow","Instagram Followers",15,{name:"Instagram Premium Followers"}),
  service("tiktok-like","TikTok Likes",5,{name:"TikTok likes"}),
  service("mix","TikTok Reach",3,{name:"TikTok Likes and Views"}),
  service("views","Instagram Views",1.2),
 ];
 const ids=sortServicesPer1000(rows,null,retail).map(x=>x.id);
 assert.deepEqual(ids,["ig-follow","am-ig-like","tiktok-like","views","mix"]);
});
test("customer-facing service cards use shared sorter with actual per-1000 retail and without changing checkout",()=>{
 const page=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");
 assert.match(page,/import \{sortServicesPer1000\} from "\.\.\/lib\/catalogSort\.mjs"/);
 assert.match(page,/sortServicesPer1000\(services\.filter\([\s\S]{0,300}?null,s=>s\.per1000\)\.map\(s=>/);
 assert.match(page,/\/api\/checkout\/v1/);
 const api=readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8");
 assert.match(api,/legacyPublicServiceAllowed/);
 const boostero=readFileSync(new URL("../lib/boosteroCatalog.mjs",import.meta.url),"utf8");
 assert.match(boostero,/where enabled=true/);
});
