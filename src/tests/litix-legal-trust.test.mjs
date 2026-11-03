import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import config from "../next.config.mjs";

test("customer privacy URL is rewritten to a published independent legal page",async()=>{
 const routes=await config.rewrites();
 assert.ok(routes.beforeFiles.some(x=>x.source==="/privacy"&&x.destination==="/legal/privacy"));
 const privacy=readFileSync(new URL("../app/legal/privacy/page.jsx",import.meta.url),"utf8");
 assert.match(privacy,/Privacy Policy/);
 assert.match(privacy,/Card details are collected by our payment provider/);
 assert.match(privacy,/Do not send passwords/);
 const edge=readFileSync(new URL("../middleware.js",import.meta.url),"utf8");
 assert.match(edge,/NextResponse\.redirect\(new URL\("\/legal\/privacy",request\.url\),307\)/);
});
test("customer refund-policy bookmark resolves to current published refunds route",async()=>{
 const redirects=await config.redirects();
 assert.ok(redirects.some(x=>x.source==="/refund-policy"&&x.destination==="/refunds"));
 const refunds=readFileSync(new URL("../app/refunds/page.jsx",import.meta.url),"utf8");
 assert.match(refunds,/Refunds & Order Issues/);
});
test("privacy tokens cannot leak in referrer and pages are protected against framing",async()=>{
 const values=(await config.headers()).flatMap(x=>x.headers);
 const byKey=Object.fromEntries(values.map(x=>[x.key.toLowerCase(),x.value]));
 assert.equal(byKey["referrer-policy"],"no-referrer");
 assert.equal(byKey["x-frame-options"],"DENY");
 assert.equal(byKey["x-content-type-options"],"nosniff");
 assert.match(byKey["permissions-policy"],/camera=\(\)/);
});
