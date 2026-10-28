import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import manifest from "../app/manifest.js";
const root = new URL("../",import.meta.url);

test("Litix mobile app manifest stays branded and same-origin",()=>{
  const m=manifest();
  assert.equal(m.id,"/");
  assert.equal(m.start_url,"/");
  assert.equal(m.scope,"/");
  assert.equal(m.display,"standalone");
  assert.equal(m.short_name,"Litix");
  assert.equal(m.lang,"en");
  assert.equal(m.theme_color,"#0c1b34");
  assert.ok(m.icons.some(i=>i.sizes==="192x192"&&i.type==="image/png"));
  assert.ok(m.icons.some(i=>i.sizes==="512x512"&&i.type==="image/png"));
  assert.ok(m.icons.every(i=>i.src.startsWith("/icons/")&&!i.src.includes("http")));
  assert.equal(m.screenshots,undefined);
  assert.equal(m.shortcuts,undefined);
});
test("manifest cannot touch payment, supplier, database, or caching",async()=>{
  const src=await readFile(new URL("../app/manifest.js",import.meta.url),"utf8");
  assert.doesNotMatch(src,/checkout|PayKings|collect\.js|NMI_|secret|SMMGLOB|Boostero|serviceWorker|navigator|cache\.open|fetch\(/i);
});
