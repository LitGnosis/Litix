import test from "node:test";
import assert from "node:assert/strict";
import {NATIVE_PREMIUM_PRODUCTS,createNativePremiumAsset} from "../lib/litixNativePremiumAssets.mjs";
const brief={business:"Creator Workshop",audience:"independent shop owners",offer:"a practical content strategy",
 action:"See details",platform:"Instagram",website:"https://example.com/learn"};
test("premium kit is separate from free starter tools and is not publicly activated",()=>{
 assert.equal(NATIVE_PREMIUM_PRODUCTS.length,1);
 assert.equal(NATIVE_PREMIUM_PRODUCTS[0].publiclyPurchasable,false);
 assert.equal(NATIVE_PREMIUM_PRODUCTS[0].requiresSettledPayment,true);
 assert.equal(NATIVE_PREMIUM_PRODUCTS[0].id,"litix-native-30day-campaign-pro");
});
test("owned premium product builds 30 distinct prompts with original editable CSV",()=>{
 const first=createNativePremiumAsset({serviceId:NATIVE_PREMIUM_PRODUCTS[0].id,brief});
 const second=createNativePremiumAsset({serviceId:NATIVE_PREMIUM_PRODUCTS[0].id,brief});
 assert.equal(first.content,second.content);assert.equal(first.sha256,second.sha256);
 assert.equal(first.rows,30);assert.equal(first.mimeType,"text/csv; charset=utf-8");
 assert.equal(first.content.trim().split("\r\n").length,31);
 assert.equal(first.deliveryState,"UNPAID_PREPARED_NOT_DELIVERED");
 assert.match(first.content,/utm_content=day_30/);
 assert.match(first.content,/utm_source=instagram/);
 assert.match(first.content,/Product overview/);
 assert.match(first.content,/Limits and trade-offs/);
 assert.match(first.filename,/30day-campaign-pro\.csv$/);
});
test("reject social-engagement SKU, poor brief, untrusted destination and CSV formulas",()=>{
 assert.throws(()=>createNativePremiumAsset({serviceId:"litix-native-followers",brief}),/UNSUPPORTED/);
 assert.throws(()=>createNativePremiumAsset({serviceId:NATIVE_PREMIUM_PRODUCTS[0].id,brief:{...brief,business:"x"}}),/BRIEF_INVALID/);
 for(const website of ["javascript:alert(1)","https://localhost/private","http://example.com",
   "https://username:secret@example.com"]){
  assert.throws(()=>createNativePremiumAsset({serviceId:NATIVE_PREMIUM_PRODUCTS[0].id,brief:{...brief,website}}),/DESTINATION_INVALID/);
 }
 const malicious=createNativePremiumAsset({serviceId:NATIVE_PREMIUM_PRODUCTS[0].id,
  brief:{...brief,business:"=HYPERLINK",action:"=IMPORTXML"}});
 assert.match(malicious.content,/"'=HYPERLINK/);
 assert.match(malicious.content,/"'=IMPORTXML"/);
});
