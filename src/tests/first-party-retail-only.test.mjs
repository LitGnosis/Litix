import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("single checkout cannot charge legacy numeric services",()=>{
 const api=source("app/api/checkout/v1/route.js");
 assert.match(api,/body\?\.serviceId/);
 assert.match(api,/body\?\.serviceKind!=="creative_kit"/);
 assert.match(api,/chargeAttempted:false/);
 assert.doesNotMatch(api,/boosteroOrderHandler|boosteroProduction|api\/transact\.php/);
 assert.match(api,/\/v1\/internal\/retail\/checkout/);
});
test("catalog is independent of reseller service lists",()=>{
 for(const path of ["app/api/catalog/v1/route.js",
                    "app/api/catalog/global/route.js",
                    "app/api/catalog/checkout-choices/route.js"]){
  const code=source(path);
  assert.doesNotMatch(code,/allBoosteroCardsSnapshot|boosteroProduction|smmglob/i);
  assert.match(code,/items:\[\]/);
 }
});
test("legacy card payment route removed; old order lookup preserved",()=>{
 const code=source("app/api/[action]/route.js");
 const post=code.slice(code.indexOf("export async function POST"));
 assert.match(post,/lookupOrderByEmail/);
 assert.match(post,/resendPaidOrderConfirmation/);
 assert.match(post,/FIRST_PARTY_ONLY/);
 assert.doesNotMatch(post,/transact\.php|smm\("add"/);
});
test("new checkout is first-party with no-charge fail-closed capacity checks",()=>{
 const ui=source("components/LitixDirectRetailCheckout.jsx");
 const api=source("app/api/direct-retail/catalog/route.js");
 assert.match(ui,/LitixDirectRetailCheckout/);
 assert.match(ui,/PremiumInlineCheckout/);
 assert.match(ui,/services:/);
 assert.match(api,/\/v1\/internal\/retail\/catalog/);
 assert.doesNotMatch(api,/Boostero|smmglob|supplierApi/i);
 const home=source("app/page.jsx");
 assert.match(home,/<LitixDirectRetailCheckout\s*\/>/);
 assert.doesNotMatch(home,/<PremiumInlineCheckout/);
});
test("recurring and bundle vendor-backed sales cannot be newly charged",()=>{
 const paths=[
 "app/api/autolikes/enroll/route.js",
 "app/api/autolikes/prepaid/checkout/route.js",
 "app/api/bundles/checkout/route.js",
 "app/api/bundles/bluevine/route.js",
 "app/api/internal/boostero/order/route.js"
 ];
 for(const path of paths){
  const code=source(path);
  assert.match(code,/chargeAttempted:false|paymentInitiated:false|supplierApiCalled:false|recurringSubscriptionCreated:false/);
  assert.doesNotMatch(code,/transact\.php|boosteroProduction\(/);
 }
});
