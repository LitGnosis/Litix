import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SHOP_CATEGORIES} from "../lib/litixShopRoutes.mjs";
import {SERVICE_NAV_GROUPS} from "../lib/serviceNavigation.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Quick shop links only to real supported category routes",()=>{
  const source=read("components/LitixQuickShop.jsx");
  assert.match(source,/Custom Likes — Choose Your Posts/);
  const urls=[...source.matchAll(/href: "(\/shop\/[^"]+)"/g)].map(x=>x[1]);
  assert.equal(urls.length,9);
  for(const url of urls)assert.ok(SHOP_CATEGORIES.some(c=>c.href===url),url);
  assert.ok(source.includes('href="/track"'));
  assert.doesNotMatch(source,/Promise|guaranteed delivery|instant delivery/i);
});

test("Instagram first, then TikTok in shared service navigation",()=>{
  assert.equal(SERVICE_NAV_GROUPS[0].platform,"Instagram");
  assert.equal(SERVICE_NAV_GROUPS[1].platform,"TikTok");
});

test("Homepage renders quick shop before promotional content, no new checkout",()=>{
  const home=read("app/page.jsx");
  assert.match(home,/import LitixQuickShop from "\.\.\/components\/LitixQuickShop"/);
  assert.ok(home.indexOf("<LitixQuickShop/>")<home.indexOf("<GrowthBundles/>"));
  assert.match(home,/fetch\("\/api\/checkout\/v1"/);
});

test("Manual post-link fallback does not require gallery username",()=>{
  const picker=read("components/SocialMultiPostChooser.jsx");
  const field=picker.match(/<input value=\{username\}[\s\S]*?\/>/)?.[0];
  assert.ok(field,"profile field is present");
  assert.doesNotMatch(field,/\brequired\b/);
  assert.match(picker,/paste links directly below without entering a username/);
  assert.match(picker,/add direct post links below/i);
});

test("Boostero-only read-only status route no longer checks retired supplier",()=>{
  const status=read("app/api/status/route.js");
  assert.doesNotMatch(status,/SMMGLOB|smmglob/);
  assert.match(status,/BOOSTERO_API_URL/);
  assert.match(status,/LITIX_BOOSTERO_ENABLED/);
  assert.match(status,/supplier: "Boostero"/);
  assert.match(status,/select 1/);
  assert.doesNotMatch(status,/put_object|payment_token|supplierOrderId|boosteroProduction\("add"\)/);
});

test("Existing multi-post and payment guards are preserved",()=>{
  const shop=read("app/page.jsx"),backend=read("lib/boosteroOrderHandler.mjs");
  assert.match(shop,/SocialMultiPostChooser/);
  assert.match(shop,/postAllocations:multiPosts\.map/);
  assert.match(backend,/data\.postAllocations\.length>5/);
  assert.match(backend,/Multi-post checkout is available only for approved Litix Likes services/);
  assert.match(backend,/idempotencyKey/);
});
