import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const handler=read("lib/boosteroOrderHandler.mjs");
const page=read("app/page.jsx");
const chooser=read("components/TikTokMultiPostChooser.jsx");
const fulfillment=read("lib/boosteroFulfillment.mjs");
test("multiple TikTok post checkout validates every video before payment",()=>{
 const serviceCheck=handler.indexOf("const multiple=Array.isArray(data?.postAllocations)");
 const canonicalCheck=handler.indexOf("resolveTikTokVideoLink(item?.link)");
 const amountCheck=handler.indexOf("Number(data?.expectedAmountCents)!==quote.amountCents");
 const payment=handler.indexOf('type:"sale",payment_token:gatewayToken');
 assert.ok(serviceCheck>=0&&canonicalCheck>serviceCheck&&amountCheck>canonicalCheck&&payment>amountCheck);
 assert.match(handler,/seen\.has\(canonical\)/);
 assert.match(handler,/boosteroQuote\(\{service:supplierService,quantity:count\}\)/);
 assert.match(handler,/totalQty!==quantity/);
 assert.match(handler,/totalCents\+=one\.amountCents/);
 assert.match(handler,/multiple\?\{postAllocations:verifiedPosts/);
});
test("one card charge, no automatic supplier dispatch for multi-post orders",()=>{
 assert.match(handler,/const attempt=multiple\?\{submitted:false,state:"MANUAL_REVIEW",requiresReview:false\}/);
 assert.match(handler,/multiple\?"MANUAL_REVIEW":"QUEUED"/);
 assert.match(handler,/multiple\?"manual_review":"pending"/);
 assert.match(handler,/Checkout already submitted; no repeat charge/);
 assert.match(handler,/with new_order as \(insert into public\.litix_v2_orders/);
 assert.match(handler,/with verified as \(update public\.litix_v2_orders/);
 assert.match(handler,/postAllocations:verifiedPosts/);
 assert.match(fulfillment,/ACTION REQUIRED: Manual TikTok multi-post fulfillment/);
 assert.match(fulfillment,/Submit each video separately to the existing supplier/);
});
test("approved TikTok Likes IDs register before charging but disabled IDs cannot be re-enabled",()=>{
 const approval=handler.indexOf("verified_live_checkout");
 const balance=handler.indexOf('balance=await boosteroProduction("balance")');
 const gateway=handler.indexOf('https://paykings.transactiongateway.com/api/transact.php');
 assert.ok(approval>0&&approval<balance&&balance<gateway);
 assert.match(handler,/on conflict\(supplier_service_id\) do nothing/);
 assert.match(handler,/where supplier_service_id=\$1 and enabled=true/);
 assert.match(handler,/no payment attempted/);
});
test("customer can switch single/multiple, verify links and allot per-post likes",()=>{
 assert.match(page,/Choose multiple posts/);
 assert.match(page,/TikTokMultiPostChooser/);
 assert.match(page,/postAllocations:multiPosts\.map/);
 assert.match(page,/verifiedMultiPosts/);
 assert.match(page,/orderQuantity=multiMode\?/);
 assert.match(page,/multiPosts\.reduce/);
 assert.match(chooser,/Verify video/);
 assert.match(chooser,/minimum/);
 assert.match(chooser,/Maximum|maximum|5/);
 assert.match(chooser,/\/api\/tiktok\/resolve/);
 assert.doesNotMatch(chooser,/BOOSTERO_API_KEY|NMI_SECURITY_KEY/);
});
