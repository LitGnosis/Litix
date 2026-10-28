import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildActiveStorefrontCatalog} from "../lib/activeStorefrontCatalog.mjs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const approved=(id,category,price)=>({id:"boostero_"+id,name:category+" Premium",category,
 kind:category.endsWith("Likes")?"likes":"followers",
 platform:category.startsWith("Instagram")?"Instagram":"TikTok",
 purchasable:true,per1000:price,startingAmountCents:500,min:500,max:100000});
const current=[
 approved(5461,"Instagram Followers",15),
 approved(4751,"Instagram Likes",6.99),
 approved(5101,"TikTok Followers",14.99),
 approved(5251,"TikTok Likes",6.99),
 {id:"33442",name:"TikTok Saves",category:"TikTok Saves",purchasable:false,per1000:5},
 {id:"33443",name:"TikTok Shares",category:"TikTok Shares",purchasable:false,per1000:5},
 {id:"33679",name:"Instagram Impressions",category:"Instagram Impressions",purchasable:false,per1000:5},
 {...approved(9999,"Instagram Followers",8),purchasable:false},
 {...approved(7777,"TikTok Followers",9),startingAmountCents:100},
 {...approved(7000,"TikTok Likes",6),category:"Instagram Reposts"}
];
test("only approved purchasable Boostero cards, no $5 unavailable legacy cards",()=>{
 const v=buildActiveStorefrontCatalog(current,new URLSearchParams());
 assert.deepEqual(v.items.map(x=>x.id),["boostero_5461","boostero_4751","boostero_5101","boostero_5251"]);
 assert.equal(v.total,4);assert.equal(v.allCount,4);
 assert.equal(v.catalogStatus,"live");assert.equal(v.boosteroOnly,true);
 assert.ok(v.items.every(x=>x.purchasable===true&&x.id.startsWith("boostero_")));
 assert.equal(v.items.some(x=>/Saves|Shares|Impressions/.test(x.name)),false);
});
test("filters, recommendations and pagination can never fall back to legacy supplier",()=>{
 const filters=[
 ["platform=TikTok&kind=likes",["boostero_5251"]],
 ["category=Instagram%20Followers",["boostero_5461"]],
 ["q=impressions",[]],["page=999",[]],
 ["goal=Grow+audience",["boostero_5461","boostero_4751","boostero_5101","boostero_5251"]]
 ];
 for(const [query,ids] of filters){
  const v=buildActiveStorefrontCatalog(current,new URLSearchParams(query));
  assert.deepEqual(v.items.map(x=>x.id),ids);
  assert.ok(v.total<=4);
 }
 const empty=buildActiveStorefrontCatalog([],new URLSearchParams());
 assert.equal(empty.catalogStatus,"unavailable");assert.deepEqual(empty.items,[]);
});
test("all public catalog routes contain no retired supplier HTTP fallback",()=>{
 const catalog=source("app/api/catalog/v1/route.js");
 const other=source("app/api/litix-multi-catalog/route.js");
 const cron=source("app/api/v2/cron/sync-catalog/route.js");
 assert.match(catalog,/enabledBoosteroCards/);
 assert.match(catalog,/buildActiveStorefrontCatalog/);
 assert.doesNotMatch(catalog,/smmservices|original\.json\(|getServices\(/i);
 assert.match(other,/catalog\/v1\/route\.js/);
 assert.match(cron,/410/);
});
test("legacy checkout and supplier calls are rejected before payment or supplier network calls",()=>{
 const legacy=source("app/api/[action]/route.js");
 const checkout=source("app/api/checkout/v1/route.js");
 assert.match(legacy,/async function smm\(\)\{throw Error\(/);
 assert.match(legacy,/if\(op==="smmservices"\)\{[\s\S]*?410/);
 assert.match(legacy,/return send\(\{error:"Retired supplier checkout is disabled\./);
 assert.doesNotMatch(legacy,/https:\/\/smmglob\.com\/api\/v2/);
 assert.doesNotMatch(legacy,/await smm\("status"/);
 assert.match(checkout,/if\(!\/\^boostero_\[0-9\]/);
 assert.doesNotMatch(checkout,/return checkout\(/);
});
test("frontend removes retired supplier favorites and never advertises old full catalog",()=>{
 const page=source("app/page.jsx");
 assert.match(page,/VERIFIED AVAILABLE SERVICES/);
 assert.match(page,/const isCurrentCard=s=>String\(s\?\.id\|\|""\)\.startsWith\("boostero_"\)/);
 assert.doesNotMatch(page,/FULL SUPPLIER CATALOG/);
});
