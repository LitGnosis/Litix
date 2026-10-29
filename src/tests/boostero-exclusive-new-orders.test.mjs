import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const legacy=read("../app/api/[action]/route.js");
const publicCatalog=read("../app/api/catalog/v1/route.js");
const checkout=read("../app/api/checkout/v1/route.js");
const catalogGuard=read("../lib/activeStorefrontCatalog.mjs");
test("every legacy checkout is rejected BEFORE card parsing, gateway or supplier dispatch",()=>{
 const start=legacy.indexOf('if(name(req)!=="checkout")');
 const guard=legacy.indexOf("return send({error:\"Retired supplier checkout is disabled.",start);
 const gateway=legacy.indexOf("fetch(gatewayUrl",start);
 const body=legacy.indexOf("await req.json()",start);
 assert.ok(start>=0&&guard>start&&body>guard&&gateway>guard);
 assert.match(legacy,/No payment was attempted/);
 assert.match(checkout,/^\s*if\(!\/\^boostero_/m);
 assert.match(checkout,/Only verified Boostero services are available/);
 assert.doesNotMatch(checkout,/smmglob\.com|smmfollowom/i);
});
test("public catalog can only publish explicitly approved Boostero cards",()=>{
 assert.match(publicCatalog,/enabledBoosteroCards\(\)/);
 assert.match(publicCatalog,/buildActiveStorefrontCatalog\(rows,params\)/);
 assert.doesNotMatch(publicCatalog,/smmglob|smmfollowom/i);
 assert.match(catalogGuard,/\^boostero_/);
 assert.match(catalogGuard,/purchasable===true/);
 assert.equal(catalogGuard.includes("https://smmglob.com"),false);
});
test("historical order lookup stays read-only and never calls retired supplier",()=>{
 assert.match(legacy,/async function refreshSupplierOrder/);
 assert.match(legacy,/litix_boostero_fulfillment/);
 assert.match(legacy,/Historical order: showing last saved status/);
 assert.match(legacy,/async function smm\(\)\{throw Error/);
 assert.doesNotMatch(legacy,/await smm\("status"\)/);
});
