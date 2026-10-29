import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildActiveStorefrontCatalog} from "../lib/activeStorefrontCatalog.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const approved=(id,category,price)=>({
 id:"boostero_"+id,name:category+" verified service",category,per1000:price,
 platform:category.split(" ")[0],kind:category.endsWith("Followers")?"followers":"likes",
 startingAmountCents:500,purchasable:true
});
const all=[
 approved("5461","Instagram Followers",15),
 approved("4751","Instagram Likes",6.99),
 approved("5101","TikTok Followers",14.99),
 approved("5251","TikTok Likes",6.99),
 {id:"33442",name:"Retired Supplier Product",category:"Instagram Followers",
   per1000:1,startingAmountCents:500,purchasable:true},
 {...approved("9999","Instagram Followers",7),purchasable:false},
 {...approved("7777","TikTok Likes",5),startingAmountCents:100},
 {...approved("8888","YouTube Views",12),purchasable:true}
];
test("production storefront publishes only approved, correctly priced and namespaced Boostero cards",()=>{
 const result=buildActiveStorefrontCatalog(all,new URLSearchParams());
 assert.equal(result.total,4);
 assert.equal(result.boosteroOnly,true);
 assert.deepEqual(new Set(result.items.map(x=>x.id)),
   new Set(["boostero_5461","boostero_4751","boostero_5101","boostero_5251"]));
 assert.ok(result.items.every(x=>x.purchasable===true&&x.startingAmountCents>=500));
});
test("filters, sorts and out-of-range pages cannot reveal retired or disabled services",()=>{
 const cases=[["platform=TikTok&kind=likes",["boostero_5251"]],
 ["category=Instagram%20Followers",["boostero_5461"]],
 ["q=Retired",[]],["page=999",[]]];
 for(const [q,expected] of cases){
  const result=buildActiveStorefrontCatalog(all,new URLSearchParams(q));
  assert.deepEqual(result.items.map(x=>x.id),expected);
  assert.ok(result.total<=4);
 }
});
test("empty supplier allowlist stays empty instead of inventing fallback products",()=>{
 const result=buildActiveStorefrontCatalog([],new URLSearchParams());
 assert.equal(result.total,0);
 assert.deepEqual(result.items,[]);
 assert.equal(result.catalogStatus,"unavailable");
});
test("public catalog and its compatibility routes cannot call retired supplier",()=>{
 const files=["app/api/catalog/v1/route.js","app/api/litix-multi-catalog/route.js","app/api/v2/cron/sync-catalog/route.js"];
 const code=files.map(read);
 assert.match(code[0],/enabledBoosteroCards/);
 assert.match(code[0],/buildActiveStorefrontCatalog/);
 assert.doesNotMatch(code.join("\n"),/https:\/\/smmglob\.com|smmfollowom/i);
 const current=read("app/api/checkout/v1/route.js");
 assert.match(current,/handleBoosteroOrder/);
 assert.match(current,/No charge attempted/);
});
