import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {cleanPartnerAttribution,partnerAttributionLabel} from "../lib/litixPartnerAttribution.mjs";
import {validatePartnerInquiry} from "../lib/partnerApplications.mjs";
import {GLOBAL_CODES,GLOBAL_LOCALES} from "../lib/globalLocales.mjs";
import sitemap from "../app/sitemap.js";

const sample={
 name:"Agency Contact",email:"growth@example.com",organization:"Example Agency",
 website:"https://example.com",type:"agency",
 goals:"We manage a network of client campaigns across several markets.",
 consent:true,websiteTrap:""
};
test("Marketing source tags accept only short, anonymous safe tokens",()=>{
 const x=cleanPartnerAttribution({utm_source:" Global_ES ",utm_medium:"owned",
   utm_campaign:"agency2026",utm_content:"header",ref:"B2B-Launch",
   email:"secret@example.com",phone:"5555555555",
   internal:"do-not-show"});
 assert.deepEqual(Object.keys(x),["utm_source","utm_medium","utm_campaign","utm_content","ref"]);
 assert.equal(x.utm_source,"global_es");
 assert.equal(x.ref,"b2b-launch");
 assert.doesNotMatch(JSON.stringify(x),/secret@|55555|internal/);
 const invalid=cleanPartnerAttribution({utm_source:"foo@example.com",
   utm_medium:"<script>",utm_campaign:"x".repeat(300),ref:"../admin"});
 assert.deepEqual(invalid,{});
 assert.equal(partnerAttributionLabel(invalid),"direct_or_unknown");
});
test("Partner inquiry retains sanitized tags without promising commission",()=>{
 const got=validatePartnerInquiry({...sample,attribution:{
  utm_source:" global_de ",utm_medium:"owned",utm_campaign:"agency",
  userEmail:"secret@example.com",ref:"special?secret=abcd"}});
 assert.equal(got.ok,true);
 assert.equal(got.data.attribution.utm_source,"global_de");
 assert.equal(got.data.attribution.ref,undefined);
 assert.equal(got.data.attribution.userEmail,undefined);
 assert.equal(validatePartnerInquiry({...sample,consent:false}).ok,false);
 assert.equal(validatePartnerInquiry({...sample,websiteTrap:"spam"}).spam,true);
});
test("Global agency funnel uses the existing products and existing partner intake, no fake payouts",async()=>{
 const page=await readFile(new URL("../app/for-agencies/page.jsx",import.meta.url),"utf8");
 const partnerPage=await readFile(new URL("../app/partners/page.jsx",import.meta.url),"utf8");
 const form=await readFile(new URL("../components/PartnerApplication.jsx",import.meta.url),"utf8");
 const server=await readFile(new URL("../app/api/partners/route.js",import.meta.url),"utf8");
 assert.match(page,/href="\/shop"/);
 assert.match(page,/href="\/bundles"/);
 assert.match(page,/href="\/track"/);
 assert.match(page,/utm_source=agency_page/);
 assert.match(page,/utm_campaign=global_agencies/);
 assert.match(page,/(prices|pricing)/i);
 assert.match(page,/(review|confirm)/i);
 assert.match(partnerPage,/PartnerApplication/);
 assert.match(form,/cleanPartnerAttribution/);
 assert.match(server,/partnerAttributionLabel/);
 assert.match(server,/manual review required/);
 assert.doesNotMatch(page,/guaranteed (followers|likes|views)/i);
 assert.match(page,/no automatic wholesale discounts/i);
 assert.doesNotMatch(page,/Litix Native|caption kit|link page|campaign planner/i);
});
test("Six localized pages route agency interest to a consented existing form",async()=>{
 const page=await readFile(new URL("../app/global/[locale]/page.jsx",import.meta.url),"utf8");
 assert.equal(GLOBAL_CODES.length,6);
 for(const key of GLOBAL_CODES){
  const loc=GLOBAL_LOCALES[key];
  for(const name of ["agencyTitle","agencyCopy","agencyCta"]){
   assert.ok(typeof loc[name]==="string"&&loc[name].length>12,key+" "+name);
  }
  assert.ok(loc.metaDescription.length>60);
  assert.match(loc.paymentNote,/USD/i);
 }
 assert.match(page,/utm_source=global_/);
 assert.match(page,/href:"\/bundles"/);
 assert.match(page,/href:"\/track"/);
 assert.match(page,/languages:GLOBAL_LANG_ALTERNATES/);
});
test("Agency path is discoverable, checkout and supplier endpoints unchanged",async()=>{
 const sitemapRows=sitemap().map(x=>x.url);
 assert.ok(sitemapRows.includes("https://www.litix.net/for-agencies"));
 assert.equal(sitemapRows.filter(x=>x.endsWith("/for-agencies")).length,1);
 assert.equal(sitemapRows.filter(x=>x.includes("/global/")).length,6);
 for(const path of ["../app/api/partners/route.js","../app/api/checkout/v1/route.js",
  "../lib/boosteroOrderHandler.mjs","../app/shop/page.jsx","../app/track/page.jsx"]){
  const src=await readFile(new URL(path,import.meta.url),"utf8");
  assert.ok(src.length>0,"Missing existing backend "+path);
 }
});
