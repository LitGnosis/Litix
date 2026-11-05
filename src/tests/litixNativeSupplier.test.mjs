import test from "node:test";
import assert from "node:assert/strict";
import {litixNativeServices,litixNativeService,previewLitixNativeAsset} from "../lib/litixNativeSupplier.mjs";
const captionBrief={business:"Elm Street Bakery",audience:"local pastry lovers",offer:"a fresh weekend menu",action:"Visit our website",platform:"Instagram"};

test("first-party inventory is not publicly purchasable",()=>{
 const services=litixNativeServices();
 assert.equal(services.length,3);
 assert.ok(services.every(s=>s.publiclyPurchasable===false&&s.status==="INTERNAL_QA_ONLY"));
 assert.equal(litixNativeService("boostero_5271"),null);
 assert.equal(litixNativeService("litix-native-followers"),null);
});
test("preview caption kit is deterministic and never a completed order",()=>{
 const a=previewLitixNativeAsset({serviceId:"litix-native-caption-kit",brief:captionBrief});
 const b=previewLitixNativeAsset({serviceId:"litix-native-caption-kit",brief:captionBrief});
 assert.equal(a.content,b.content);
 assert.equal(a.sha256,b.sha256);
 assert.equal(a.previewHash,b.previewHash);
 assert.equal(a.deliveryState,"PREVIEW_ONLY_NOT_PURCHASED");
 assert.equal(a.publiclyPurchasable,false);
 assert.match(a.content,/Elm Street Bakery/);
 assert.match(a.content,/6\. Professional announcement/);
});
test("reject unsupported and artificial-engagement SKUs",()=>{
 assert.throws(()=>previewLitixNativeAsset({serviceId:"litix-native-followers",brief:captionBrief}),/NATIVE_SERVICE_NOT_SUPPORTED/);
 assert.throws(()=>previewLitixNativeAsset({serviceId:"litix-native-caption-kit",brief:{...captionBrief,platform:"FakeSocial"}}),/NATIVE_PLATFORM_INVALID/);
 assert.throws(()=>previewLitixNativeAsset({serviceId:"litix-native-caption-kit",brief:{business:"x"}}));
});
test("link page is escaped and empty briefs cannot be delivered",()=>{
 const asset=previewLitixNativeAsset({serviceId:"litix-native-link-page",brief:{name:"Neighborhood Shop",tagline:"A <safe> shop",links:[{label:"Visit <Store>",url:"https://example.com"}]}});
 assert.equal(asset.mimeType,"text/html; charset=utf-8");
 assert.match(asset.content,/A &lt;safe&gt; shop/);
 assert.match(asset.content,/Visit &lt;Store&gt;/);
 assert.doesNotMatch(asset.content,/A <safe>/);
 assert.throws(()=>previewLitixNativeAsset({serviceId:"litix-native-link-page",brief:{name:"Shop",links:[]}}));
});
