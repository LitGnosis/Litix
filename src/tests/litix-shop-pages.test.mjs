import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SHOP_CATEGORIES,shopCategory} from "../lib/litixShopRoutes.mjs";
import {SERVICE_NAV_GROUPS,allowedServiceFilter} from "../lib/serviceNavigation.mjs";
import {matchesServiceQuickKind} from "../lib/catalogSort.mjs";
import {litixKind} from "../lib/litixServiceClassify.mjs";
const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");

test("competitor-style shop navigation has 23 unique valid live-catalog filters",()=>{
 assert.equal(SHOP_CATEGORIES.length,23);
 assert.equal(new Set(SHOP_CATEGORIES.map(x=>x.href)).size,23);
 assert.deepEqual([...new Set(SHOP_CATEGORIES.map(x=>x.slug))],["tiktok","instagram","youtube","x","facebook"]);
 for(const page of SHOP_CATEGORIES){
  assert.equal(shopCategory(page.slug,page.kind),page);
  assert.equal(allowedServiceFilter(page.platform,page.kind),true);
  assert.match(page.href,/^\/shop\/(?:tiktok|instagram|youtube|x|facebook)\/[a-z]+$/);
 }
 assert.equal(SERVICE_NAV_GROUPS.length,5);
 assert.ok(shopCategory("facebook","likes"));
 assert.equal(shopCategory("facebook","saves"),null);
 assert.equal(shopCategory("tiktok","fake"),null);
});

test("platform pages select existing filtered Litix directory, never create fake supplier services",()=>{
 const page=read("../app/shop/[platform]/[kind]/page.jsx");
 const directory=read("../components/LitixDirectory.jsx");
 assert.match(page,/generateStaticParams/);
 assert.match(page,/notFound\(\)/);
 assert.match(page,/initialPlatform=\{selected\.platform\}/);
 assert.match(page,/initialKind=\{selected\.kind\}/);
 assert.match(directory,/allowedServiceFilter\(initialPlatform,initialKind\)/);
 assert.match(directory,/fetch\("\/api\/catalog\/global\?/);
 assert.match(directory,/s\.purchasable===true/);
 assert.match(directory,/href=\{"\/\?service="/);
});

test("supplier directory reuses validated catalog instead of fetching the same supplier list twice",()=>{
 const route=read("../app/api/catalog/global/route.js");
 assert.match(route,/allBoosteroCardsSnapshot\(\)/);
 assert.doesNotMatch(route,/boosteroProduction\("services"\)/);
 assert.match(route,/filter\(s=>s\.purchasable===true\)/);
 assert.match(route,/cache-control":"no-store"/);
});

test("platform pages are discoverable and link to existing tracking without changing checkout",()=>{
 const home=read("../app/page.jsx");
 const index=read("../app/shop/page.jsx");
 const sitemap=read("../app/sitemap.js");
 assert.match(home,/href="\/shop"/);
 assert.doesNotMatch(home,/request a quote directly from Litix/);
 assert.match(index,/href="\/track"/);
 assert.match(sitemap,/SHOP_CATEGORIES\.map/);
});

test("existing approved comments, shares and saves can be discovered accurately",()=>{
 for(const kind of ["comments","shares","saves"]){
  assert.equal(allowedServiceFilter("Instagram",kind),true);
  assert.equal(allowedServiceFilter("TikTok",kind),true);
  const name="Instagram "+kind[0].toUpperCase()+kind.slice(1);
  assert.equal(litixKind(name,"Instagram"),kind);
  assert.equal(matchesServiceQuickKind({name,category:"Instagram"},kind),true);
  assert.equal(matchesServiceQuickKind({name:"Instagram Likes and "+kind,category:"Instagram"},kind),false);
 }
 assert.equal(allowedServiceFilter("YouTube","comments"),true);
 assert.equal(allowedServiceFilter("Facebook","followers"),true);
 assert.equal(allowedServiceFilter("YouTube","saves"),false);
});
