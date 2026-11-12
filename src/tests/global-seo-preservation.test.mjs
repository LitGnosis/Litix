import test from "node:test";
import assert from "node:assert/strict";
import sitemap from "../app/sitemap.js";
import robots from "../app/robots.js";
import {GLOBAL_CODES} from "../lib/globalLocales.mjs";
test("Native sitemap carries all six locales and legacy marketing paths",()=>{
 const entries=sitemap();
 const base="https://litix.net";
 const urls=entries.map(e=>e.url);
 assert.equal(new Set(urls).size,urls.length);
 for(const code of GLOBAL_CODES){
  const row=entries.find(x=>x.url===base+"/global/"+code);
  assert.ok(row,code+" page is in sitemap");
  assert.equal(row.alternates.languages[code],base+"/global/"+code);
  assert.equal(row.alternates.languages["x-default"],base+"/global/en");
  assert.equal(Object.keys(row.alternates.languages).length,7);
 }
 for(const path of ["/about","/platform","/acceptable-use","/resources/visibility-acceleration","/privacy","/terms","/refunds"]){
  assert.ok(urls.includes(base+path),"Preserve previous SEO/legal URL "+path);
 }
 assert.ok(!urls.some(x=>/api\//.test(x)));
});
test("Native robots preserves old protected routes and blocks owner dashboards",()=>{
 const data=robots();
 assert.equal(data.sitemap,"https://litix.net/sitemap.xml");
 assert.equal(data.host,"https://litix.net");
 const excludes=data.rules[0].disallow;
 for(const path of ["/api/","/account","/signin","/checkout","/guardian/admin","/bundles/admin"]){
  assert.ok(excludes.includes(path),"Crawler exclusion "+path);
 }
 assert.equal(data.rules[0].allow,"/");
});
