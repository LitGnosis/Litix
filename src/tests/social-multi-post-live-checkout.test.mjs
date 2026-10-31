import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeProfile,canonicalPost,divideLikes} from "../lib/postPicker.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("app/page.jsx"),picker=read("components/SocialMultiPostChooser.jsx"),
      handler=read("lib/boosteroOrderHandler.mjs"),fulfillment=read("lib/boosteroFulfillment.mjs");

test("Instagram and TikTok custom Likes both offer multi-post checkout",()=>{
 assert.match(page,/const likesWithPostPicker=\["instagram","tiktok"\]/);
 assert.match(page,/multiMode=likesWithPostPicker&&multiPostEnabled/);
 assert.match(page,/SocialMultiPostChooser/);
 assert.match(page,/postAllocations:multiPosts\.map/);
 assert.match(handler,/Multi-post checkout supports 2–5 Instagram or TikTok Likes posts only/);
 assert.match(handler,/boosteroDestination\(item\?\.link,"instagram","likes"\)/);
 assert.match(handler,/resolveTikTokVideoLink\(item\?\.link\)/);
});
test("Gallery stores selected public canonical URLs and validates links without raw credentials",()=>{
 assert.match(picker,/\/api\/post-picker/);
 assert.match(picker,/aria-pressed=\{selected\.has\(p\.url\)\}/);
 assert.match(picker,/newTikTokPost\(\{link:post\.url,quantity:minimum,verifiedUrl:post\.url\}\)/);
 assert.match(picker,/\/api\/tiktok\/resolve/);
 assert.match(picker,/canonicalPost\("instagram",input\)/);
 assert.doesNotMatch(picker,/NMI_SECURITY_KEY|BOOSTERO_API_KEY|APIFY_TOKEN|LITIX_BOOSTERO_DATABASE_URL/);
 assert.equal(normalizeProfile("instagram","@test.account"),"test.account");
 assert.equal(canonicalPost("instagram","https://www.instagram.com/p/ABCde123456/?utm_source=x"),"https://www.instagram.com/p/ABCde123456/");
 assert.deepEqual(divideLikes(1000,3),[334,333,333]);
});
test("One PayKings payment per parent order; supplier purchases are manually reviewed",()=>{
 assert.equal((handler.match(/https:\/\/paykings\.transactiongateway\.com\/api\/transact\.php/g)||[]).length,1);
 assert.match(handler,/const attempt=autoMulti/);
 assert.match(handler,/:multiple\?\{submitted:false,state:"MANUAL_REVIEW"/);
 assert.match(handler,/payment_state='paid'/);
 assert.match(handler,/Checkout already submitted; no repeat charge/);
 assert.match(handler,/postPlatform:String\(quote\.platform\)\.toLowerCase\(\)/);
 assert.match(handler,/totalCents\+=one\.amountCents/);
 assert.match(handler,/seen\.has\(canonical\)/);
 assert.match(fulfillment,/Manual Instagram multi-post fulfillment/);
 assert.match(fulfillment,/Manual TikTok multi-post fulfillment/);
 assert.match(fulfillment,/AUTOMATED PER-POST FULFILLMENT/);
 assert.match(fulfillment,/Do NOT submit any selected post manually/);
 assert.match(fulfillment,/automatedMulti=allocations.length>1/);
 assert.match(fulfillment,/litix-boostero-customer\//);
 assert.match(fulfillment,/litix-boostero-owner\//);
});
test("Server enforces known platform, default supplier kind, signed pricing and minimum per post",()=>{
 assert.match(handler,/\["instagram","tiktok"\]\.includes\(String\(quote\.platform\)/);
 assert.match(handler,/quote\.kind!=="likes"/);
 assert.match(handler,/boosteroQuote\(\{service:supplierService,quantity:count\}\)/);
 assert.match(handler,/Number\(data\?\.expectedAmountCents\)!==quote\.amountCents/);
 assert.match(handler,/verifyBoosteroQuote\(id,quoteQuantity,sql\)/);
 assert.match(handler,/const quoteQuantity=multiple\?Number\(data\.postAllocations\[0\]\?\.quantity\):quantity/);
 assert.match(handler,/if\(totalQty!==quantity\|\|totalQty>1000000/);
 assert.doesNotMatch(handler,/totalQty>Number\(supplierService\.max\)/);
 assert.match(page,/validOrderDetails\(selected,normalizedOrderLink,email,Number\(multiPosts\[0\]\?\.quantity\|\|0\)\)/);
 assert.match(handler,/Number\(balance\.balance\)<quote\.costUSD/);
 assert.match(handler,/idempotency_key\) do nothing/);
});
