import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GROWTH_BUNDLES,growthBundle} from "../lib/growthBundles.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const custom=read("components/LitixCustomHub.jsx");
const hubPage=read("app/custom-likes/page.jsx");
const quick=read("components/LitixQuickShop.jsx");
const bundles=read("components/GrowthBundles.jsx");
const style=read("app/litix-flow.css");
const layout=read("app/layout.jsx");
const home=read("app/page.jsx");

test("custom Likes and Followers offers four known approved service paths and keeps multi mode Likes-only",()=>{
 for(const id of ["litix_4751","litix_5251","litix_5461","litix_5101"]){
  assert.ok(custom.includes(id),"missing approved service "+id);
 }
 assert.match(hubPage,/LitixCustomHub/);
 assert.match(custom,/kind==="likes"\?"&mode=multi":""/);
 assert.match(custom,/encodeURIComponent\(product\.id\)/);
 assert.match(custom,/\/\?service=/);
 assert.match(custom,/href=\{customProductLink\(selected\)\}/);
 assert.match(custom,/aria-pressed=\{kind===value\}/);
 assert.match(custom,/aria-pressed=\{platform===value\}/);
 assert.doesNotMatch(custom,/fetch\(|paymentToken|startPaymentRequest|supplier_order_id/);
});

test("bundle menu displays one selected tier without changing any package, amounts or payment URLs",()=>{
 assert.equal(GROWTH_BUNDLES.length,8);
 const prices=[5382,10782,19782,35982];
 for(const [i,tier] of ["launch","momentum","power","apex"].entries()){
  for(const p of ["ig","tt"])assert.equal(growthBundle(p+"_"+tier)?.priceCents,prices[i]);
 }
 assert.match(bundles,/<select id="litix-bundle-select"/);
 assert.match(bundles,/onChange=\{e=>\{setTier\(e.target\.value\)/);
 assert.match(bundles,/GROWTH_BUNDLES\.find\(x=>x\.platform===platform&&x\.tier===tier\)/);
 assert.ok(bundles.includes("Object.entries(p.items)"));
 assert.match(bundles,/&method=paykings/);
 assert.match(bundles,/&method=bluevine/);
 assert.match(bundles,/bluevineEnabled/);
 assert.match(bundles,/payKingsEnabled/);
 assert.doesNotMatch(bundles,/boosteroProduction\(|NMI_SECURITY_KEY|payment_token/);
});

test("site-wide Litix metallic branding and unobstructed mobile nav survive",()=>{
 assert.match(layout,/import "\.\/litix-flow\.css"/);
 assert.match(home,/litix-logo\.webp/);
 assert.match(quick,/INNOVATION, IGNITED/);
 assert.match(quick,/litix-platform-tabs/);
 assert.match(quick,/aria-pressed=\{platform===value\}/);
 assert.match(quick,/Custom Likes &amp; Followers/);
 assert.match(style,/@media\(max-width:750px\)/);
 assert.match(style,/position:relative!important;top:auto!important/);
 assert.match(style,/\.nav>div/);
 assert.match(style,/overflow-x:auto!important/);
 assert.match(style,/body:has\(\.litix-custom-hub\) \.lxai-launcher/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
});

test("homepage reduces scrolling and all customer routes remain available",()=>{
 assert.equal((home.match(/<GrowthBundles\/>/g)||[]).length,1);
 assert.equal((home.match(/<LitixQuickShop\/>/g)||[]).length,1);
 assert.ok(home.indexOf("<LitixQuickShop/>")<home.indexOf("<GrowthBundles/>"));
 assert.doesNotMatch(home,/Instagram & TikTok Custom Likes/);
 for(const url of ["/shop","/services","/custom-likes","/track"]){
  assert.ok(quick.includes('href="'+url+'"')||home.includes('href="'+url+'"'),"missing "+url);
 }
 assert.match(read("app/bundles/page.jsx"),/GrowthBundles standalone/);
});
