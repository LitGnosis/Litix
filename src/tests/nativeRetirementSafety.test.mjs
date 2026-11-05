import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const exists=p=>existsSync(new URL(p,root));
test("retired digital-product routes and private APIs are absent",()=>{
 for(const route of [
  "app/native/page.jsx","app/native/premium/page.jsx","app/native/order/page.jsx",
  "app/native/supply/page.jsx","app/api/native/v1/services/route.js",
  "app/api/native/v1/reseller/route.js","app/api/native/v1/paid/route.js",
  "app/api/native/v1/preview/route.js","app/tools/caption-builder/page.jsx",
  "app/tools/link-page-builder/page.jsx","app/publishers/page.jsx","app/wholesale/page.jsx"
 ])assert.equal(exists(route),false,"Unexpected retired route "+route);
});
test("main store, existing payment and supplier fulfillment are preserved",()=>{
 for(const path of [
  "app/page.jsx","app/shop/page.jsx","app/track/page.jsx",
  "lib/boosteroOrderHandler.mjs","lib/boosteroFulfillment.mjs",
  "lib/nativeAutoLikesFulfillment.mjs","lib/boosteroNativeAutoLikes.mjs",
  "app/api/config/route.js","app/api/partners/route.js"
 ])assert.equal(exists(path),true,"Working order system was removed: "+path);
});
test("no broken links to retired customer-facing routes are advertised",()=>{
 for(const path of ["app/sitemap.js","app/solutions/page.jsx",
   "app/solutions/[slug]/page.jsx","app/shop/page.jsx"]){
  const contents=readFileSync(new URL(path,root),"utf8");
  assert.doesNotMatch(contents,/href=["']\/(?:native|publishers|wholesale|tools\/caption-builder|tools\/link-page-builder)(?:\/|["'])/);
  assert.doesNotMatch(contents,/url:base\+"\/(?:native|publishers|wholesale|tools\/caption-builder|tools\/link-page-builder)/);
 }
});
