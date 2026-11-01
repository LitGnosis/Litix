import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SHOP_CATEGORIES,shopCategory} from "../lib/litixShopRoutes.mjs";
import {SERVICE_NAV_GROUPS,allowedServiceFilter} from "../lib/serviceNavigation.mjs";
const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");

test("competitor-style shop navigation has 12 unique valid live-catalog filters",()=>{
 assert.equal(SHOP_CATEGORIES.length,12);
 assert.equal(new Set(SHOP_CATEGORIES.map(x=>x.href)).size,12);
 assert.deepEqual([...new Set(SHOP_CATEGORIES.map(x=>x.slug))],["tiktok","instagram","youtube","x"]);
 for(const page of SHOP_CATEGORIES){
  assert.equal(shopCategory(page.slug,page.kind),page);
  assert.equal(allowedServiceFilter(page.platform,page.kind),true);
  assert.match(page.href,/^\/shop\/(?:tiktok|instagram|youtube|x)\/[a-z]+$/);
 }
 assert.equal(SERVICE_NAV_GROUPS.length,4);
 assert.equal(shopCategory("facebook","likes"),null);
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
