import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {litixPublicCard} from "../lib/publicLitixCatalog.mjs";

const file=rel=>readFile(new URL(rel,import.meta.url),"utf8");
test("full directory falls back to the existing durable public catalog",async()=>{
 const route=await file("../app/api/catalog/global/route.js");
 assert.match(route,/readDurableCatalog/);
 assert.match(route,/snapshot=await readDurableCatalog\(\)/);
 assert.match(route,/catalogFresh=data\.sourceStatus==="live"/);
 assert.match(route,/purchasable:catalogFresh&&s\.purchasable===true/);
 assert.match(route,/verifiedPurchasableCount:data\.approvedCount,catalogFresh/);
 assert.match(route,/cache-control/);
});
test("stale snapshot cards are browsable without active payment links",async()=>{
 const directory=await file("../components/LitixDirectory.jsx");
 assert.match(directory,/setCatalogFresh\(body\.catalogFresh===true\)/);
 assert.match(directory,/\{entries\.map\(s=>\{/);
 assert.match(directory,/const approved=s\.purchasable===true&&catalogFresh/);
 assert.match(directory,/approved\?<a className="litix-directory-buy"/);
 assert.match(directory,/Live availability required before purchase/);
 assert.match(directory,/Retry live availability/);
 assert.doesNotMatch(directory,/\{entries\.filter\(s=>s\.purchasable===true\)\.map/);
});
test("no supplier ids, costs or secret fields leak from cached public cards",()=>{
 const card=litixPublicCard({id:"boostero_3910",name:"YouTube Subscribers",
  category:"YouTube - Subscribers",platform:"YouTube",kind:"subscribers",
  min:100,max:10000,unitStep:1,type:"Default",per1000:9,
  startingAmountCents:100,purchasable:false,pricingReview:false,
  wholesaleRate:3,supplierServiceId:"3910",apiKey:"should-not-serialize"});
 assert.equal(card.id,"litix_3910");
 assert.equal(card.purchasable,false);
 for(const forbidden of ["boostero_","supplierServiceId","wholesaleRate","apiKey"])
  assert.ok(!JSON.stringify(card).includes(forbidden),forbidden);
});
