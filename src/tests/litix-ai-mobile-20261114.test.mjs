import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {guidedLitixReply} from "../lib/litixGuidedSupport.mjs";

const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("assistant is a modal with sticky safe-area header and mobile containment",async()=>{
 const [component,css,layout]=await Promise.all([
  read("../components/LitixAI.jsx"),
  read("../app/litix-ai.css"),
  read("../app/layout.jsx")
 ]);
 assert.match(component,/className="lxai-backdrop"/);
 assert.match(component,/role="dialog" aria-modal="true"/);
 assert.match(component,/Instant Order &amp; Catalog Concierge/);
 assert.match(css,/\.lxai-backdrop\s*\{/);
 assert.match(css,/background:rgba\(2,6,23,\.96\)/);
 assert.match(css,/position:sticky;top:0;z-index:20/);
 assert.match(css,/padding:calc\(12px \+ env\(safe-area-inset-top\)\)/);
 assert.match(css,/height:100dvh;max-height:100dvh/);
 assert.match(css,/overflow-x:hidden/);
 assert.match(css,/overflow-x:auto;overflow-y:hidden/);
 assert.match(layout,/viewportFit:"cover"/);
 assert.match(component,/document\.body\.style\.overflow="hidden"/);
});

test("assistant suggestions exclude retired bundles and guided responses avoid disabled-AI preambles",async()=>{
 const [component,route]=await Promise.all([
  read("../components/LitixAI.jsx"),read("../app/api/litix-ai/route.js")
 ]);
 for(const s of ["Compare USA follower tiers","How fast do orders start?","How do I track my order?"])
  assert.ok(component.includes(s));
 assert.doesNotMatch(component,/Show growth bundles|Guided support · live AI unavailable|Live AI is temporarily unavailable\./);
 assert.doesNotMatch(route,/Live AI is temporarily unavailable\./);
 assert.match(guidedLitixReply("Compare USA follower tiers"),/USA Instagram follower tiers/);
 assert.match(guidedLitixReply("How fast do orders start?"),/does not guarantee an instant start/);
 assert.match(guidedLitixReply("How do I track my order?"),/Track order/);
 assert.doesNotMatch(guidedLitixReply("What can you do?"),/Live AI answers are not currently available/);
});

test("private order lookup clears on close/open and never seeds customer data",async()=>{
 const component=await read("../components/LitixAI.jsx");
 assert.match(component,/const \[orderId,setOrderId\]=useState\("")/);
 assert.match(component,/const \[email,setEmail\]=useState\("")/);
 assert.match(component,/const resetLookup=\(\)=>/);
 assert.match(component,/const closePanel=\(\)=>\{resetLookup\(\)/);
 assert.match(component,/const selectTracking=\(\)=>\{resetLookup\(\)/);
 assert.match(component,/lookupRequest\.current\?\.abort\(\)/);
 assert.match(component,/signal:controller\.signal/);
 assert.match(component,/placeholder="e\.g\. ltx2_xxxxxxxx-xxxx-xxxx-xxxx"/);
 assert.match(component,/placeholder="e\.g\. you@example\.com"/);
 assert.match(component,/autoComplete="off"/);
 assert.doesNotMatch(component,/spears5417|96aa4526/i);
 assert.match(component,/fetch\("\/api\/order-lookup"/);
});
