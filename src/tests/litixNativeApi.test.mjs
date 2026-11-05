import test from "node:test";
import assert from "node:assert/strict";
import {GET as readCatalog} from "../app/api/native/v1/services/route.js";
import {POST as previewAsset,GET as previewGet} from "../app/api/native/v1/preview/route.js";
const endpoint="https://www.litix.net/api/native/v1/preview";
const brief={serviceId:"litix-native-caption-kit",brief:{business:"Elm Street Bakery",audience:"local pastry lovers",offer:"a weekend cake menu",action:"Visit our shop",platform:"Instagram"}};
const request=(body,overrides={})=>new Request(endpoint,{method:"POST",headers:{"content-type":"application/json",origin:"https://www.litix.net",...overrides},body:typeof body==="string"?body:JSON.stringify(body)});
test("native catalog is free, locally produced, and not publicly billable",async()=>{
 const res=await readCatalog();
 assert.equal(res.status,200);
 assert.equal(res.headers.get("cache-control"),"no-store");
 const x=await res.json();
 assert.equal(x.supplier,"Litix Native");
 assert.equal(x.paidCheckoutEnabled,false);
 assert.equal(x.externalSupplierRequired,false);
 assert.equal(x.services.length,2);
 assert.ok(x.services.every(s=>s.publiclyPurchasable===false));
});
test("preview response supplies no-charge deterministic original content",async()=>{
 const a=await previewAsset(request(brief));
 const b=await previewAsset(request(brief));
 assert.equal(a.status,200);
 assert.equal(a.headers.get("cache-control"),"no-store");
 const x=await a.json(),y=await b.json();
 assert.equal(x.sha256,y.sha256);
 assert.equal(x.deliveryState,"PREVIEW_ONLY_NOT_PURCHASED");
 assert.equal(x.publiclyPurchasable,false);
 assert.match(x.content,/Elm Street Bakery/);
 assert.equal(x.mimeType,"text/plain; charset=utf-8");
});
test("cross-origin preview forbidden without creating an order",async()=>{
 const x=await previewAsset(request(brief,{origin:"https://other.example"}));
 assert.equal(x.status,403);
 assert.equal((await x.json()).charged,false);
});
test("unknown services, malformed payloads, oversized requests denied",async()=>{
 assert.equal((await previewAsset(request({serviceId:"litix-native-followers",brief:{}}))).status,422);
 assert.equal((await previewAsset(request("{"))).status,400);
 assert.equal((await previewAsset(request("x".repeat(8001)))).status,413);
 assert.equal((await previewGet()).status,405);
});
test("link-page HTML is escaped and cannot execute injected tags",async()=>{
 const data={serviceId:"litix-native-link-page",brief:{name:"Shop",tagline:"<script>evil</script>",links:[{label:"<h1>Click</h1>",url:"https://example.com"}]}};
 const x=await (await previewAsset(request(data))).json();
 assert.match(x.content,/&lt;script&gt;evil&lt;\/script&gt;/);
 assert.doesNotMatch(x.content,/<script>evil<\/script>/);
 assert.match(x.content,/&lt;h1&gt;Click&lt;\/h1&gt;/);
});
