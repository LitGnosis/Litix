import test from "node:test";
import assert from "node:assert/strict";
import {createResilientCatalogCache} from "../lib/litixCatalogResilience.mjs";
import {buildActiveStorefrontCatalog} from "../lib/activeStorefrontCatalog.mjs";
const card={id:"boostero_5251",name:"TikTok Likes",category:"TikTok Likes",
 platform:"TikTok",kind:"likes",per1000:6.99,purchasable:true,startingAmountCents:100,min:10,max:10000};
test("a transient supplier outage serves bounded catalog cache, not empty storefront",async()=>{
 let now=1000,calls=0,fail=false;
 const cache=createResilientCatalogCache({clock:()=>now,fetchFresh:async()=>{
  calls++;if(fail)throw Error("supplier unavailable");return [card];
 }});
 assert.equal((await cache.read()).status,"live");
 now+=90001;fail=true;
 const fallback=await cache.read();
 assert.equal(fallback.status,"cached");assert.equal(fallback.items[0].id,card.id);
 const response=buildActiveStorefrontCatalog(fallback.items,new URLSearchParams(),{sourceStatus:fallback.status});
 assert.equal(response.catalogStatus,"cached");assert.equal(response.items[0].id,"litix_5251");
 assert.doesNotMatch(JSON.stringify(response),/Boostero|supplier unavail|wholesale/i);
 now+=15*60_000;
 await assert.rejects(()=>cache.read(),/supplier unavailable/);
 assert.equal(calls>=2,true);
});
test("no cached data fails closed rather than advertising supplier availability",async()=>{
 const cache=createResilientCatalogCache({fetchFresh:async()=>{throw Error("no provider")}});
 await assert.rejects(()=>cache.read(),/no provider/);
 assert.equal(buildActiveStorefrontCatalog([],new URLSearchParams()).catalogStatus,"unavailable");
});
test("concurrent cold-cache requests share one external supplier API read",async()=>{
 let calls=0;
 const cache=createResilientCatalogCache({fetchFresh:async()=>{
  calls++;await new Promise(resolve=>setTimeout(resolve,5));return [card];
 }});
 const values=await Promise.all(Array.from({length:12},()=>cache.read()));
 assert.equal(calls,1);
 assert.ok(values.every(x=>x.status==="live"&&x.items.length===1));
});
