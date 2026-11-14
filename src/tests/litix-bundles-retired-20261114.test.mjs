import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("retired bundle sales are absent from all public primary navigation and sitemap",async()=>{
 const paths=[
  "app/page.jsx","components/LitixQuickShop.jsx","components/LitixWorkspace.jsx",
  "components/LitixDirectory.jsx","components/LitixCustomHub.jsx",
  "app/services/page.jsx","app/custom-likes/page.jsx",
  "app/custom-orders/preview/page.jsx","app/shop/page.jsx",
  "app/shop/[platform]/[kind]/page.jsx","app/for-agencies/page.jsx",
  "app/global/[locale]/page.jsx","app/sitemap.js"
 ];
 for(const p of paths){
  const s=await read(p);
  assert.doesNotMatch(s,/href=["']\/bundles(?:[/"']|\?)/,p);
  assert.doesNotMatch(s,/href:\s*["']\/bundles["']/,p);
 }
 const layout=await read("app/layout.jsx");
 assert.doesNotMatch(layout,/growthBundles\.css/);
});

test("former public bundle pages permanently direct customers to individual services",async()=>{
 for(const path of ["app/bundles/page.jsx","app/bundles/checkout/page.jsx"]){
  const s=await read(path);
  assert.match(s,/permanentRedirect\("\/services"\)/);
  assert.doesNotMatch(s,/CollectJS|payment_token|startPaymentRequest|GrowthBundles/);
 }
});

test("PayKings and Bluevine cannot create new bundle charges or payment links",async()=>{
 const {GET}=await import("../app/api/bundles/route.js");
 const {POST:checkout}=await import("../app/api/bundles/checkout/route.js");
 const {POST:bluevine}=await import("../app/api/bundles/bluevine/route.js");
 const responses=[await GET(),await checkout(),await bluevine()];
 for(const r of responses){
  assert.equal(r.status,410);
  const body=await r.json();
  assert.equal(body.code,"BUNDLES_RETIRED");
  assert.equal(body.checkoutEnabled,false);
  assert.equal(body.chargeAttempted||false,false);
 }
 const offers=await GET();
 assert.deepEqual((await offers.json()).packages,[]);
});

test("historical order tracking and private confirmation remain for old customers",async()=>{
 const tracking=await read("app/api/bundles/order/route.js");
 const confirmation=await read("app/bundles/confirmation/page.jsx");
 const admin=await read("app/api/bundles/admin/route.js");
 const cron=await read("app/api/bundles/cron/route.js");
 assert.match(tracking,/tracking_token_hash/);
 assert.match(confirmation,/\/api\/bundles\/order/);
 assert.match(admin,/export async function GET/);
 assert.match(cron,/verifyNmiSettlement/);
});

test("AI no longer sells the discontinued bundles",async()=>{
 const support=await read("lib/litixGuidedSupport.mjs");
 const ai=await read("app/api/litix-ai/route.js");
 assert.match(support,/no longer sells Growth Bundles/);
 assert.doesNotMatch(support,/See \/bundles for the current/);
 assert.doesNotMatch(ai,/bundleContext\(\)|from "..\/bundles\/route.js"/);
});
