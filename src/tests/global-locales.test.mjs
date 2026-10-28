import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {GLOBAL_CODES,GLOBAL_LOCALES,GLOBAL_LANG_ALTERNATES,getGlobalLocale,isRTLGlobalLocale} from "../lib/globalLocales.mjs";
const expected=["en","es","pt","fr","de","ar"];
test("exactly six supported locale codes, no unverified market or currency activation",()=>{
 assert.deepEqual(GLOBAL_CODES,expected);
 assert.equal(GLOBAL_LANG_ALTERNATES["x-default"],"/global/en");
 assert.equal(Object.keys(GLOBAL_LANG_ALTERNATES).length,7);
 for(const code of expected)assert.equal(GLOBAL_LANG_ALTERNATES[code],"/global/"+code);
 assert.equal(getGlobalLocale("xx"),null);
 assert.equal(getGlobalLocale("__proto__"),null);
 assert.equal(isRTLGlobalLocale("ar"),true);
 assert.equal(isRTLGlobalLocale("fr"),false);
});
test("every supported locale has localized complete text and explicit English USD checkout limitation",()=>{
 const fields=Object.keys(GLOBAL_LOCALES.en);
 for(const code of expected){
   const t=getGlobalLocale(code);
   assert.deepEqual(Object.keys(t),fields);
   for(const key of fields)assert.ok(typeof t[key]==="string"&&t[key].trim().length>3,code+" "+key);
   assert.match(t.paymentNote,/USD/i,code+" must disclose USD");
   assert.ok(/(english|ingl|angl|engl)/i.test(t.paymentNote)||t.paymentNote.includes("الإنجليزية")||t.paymentNote.includes("الإنجليزي"),code+" checkout-language disclosure");
   assert.ok(t.metaDescription.length>60,code+" metadata");
   assert.doesNotMatch(JSON.stringify(t),/boostero|smmglob|wholesale|guaranteed followers|automatic charge/i);
 }
});
test("localized marketing pages never mutate checkout, prices, or supplier and expose canonical hreflang",async()=>{
 const page=await readFile(new URL("../app/global/[locale]/page.jsx",import.meta.url),"utf8");
 const sitemap=await readFile(new URL("../app/sitemap.js",import.meta.url),"utf8");
 const footer=await readFile(new URL("../app/page.jsx",import.meta.url),"utf8");
 assert.match(page,/generateStaticParams/);
 assert.match(page,/dynamicParams=false/);
 assert.match(page,/languages:GLOBAL_LANG_ALTERNATES/);
 assert.match(page,/lang=\{locale\}/);
 assert.match(page,/dir=\{rtl\?"rtl":"ltr"\}/);
 assert.match(page,/href="\/#services"/);
 assert.match(page,/href="\/#growth-studio"/);
 assert.match(page,/href:"\/track"/);
 assert.match(page,/hrefLang="en"/);
 assert.doesNotMatch(page,/submitSupplierOrder|NMI_SECURITY_KEY|paymentToken|checkout\/v1|BOOSTERO_API_KEY|neon\(/);
 assert.match(sitemap,/GLOBAL_CODES\.map/);
 assert.match(sitemap,/alternates:\{languages:/);
 assert.match(footer,/href="\/global\/en"/);
});
