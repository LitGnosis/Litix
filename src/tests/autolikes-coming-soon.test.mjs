import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {autolikesNewSalesEnabled} from "../lib/litixAutoLikesSalesGate.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("app/autolikes/page.jsx");
const storefront=read("app/page.jsx");
const prefix="app/api/autolikes";
const routes=[
 prefix+"/prepaid/checkout/route.js",
 prefix+"/prepaid/quote/route.js",
 prefix+"/prepaid/catalog/route.js",
 prefix+"/enroll/route.js",
 prefix+"/quote/route.js",
 prefix+"/catalog/route.js"
];

test("AutoLikes new sales are fail-closed for all existing checkout and quoting routes",()=>{
 assert.equal(autolikesNewSalesEnabled(),false);
 for(const name of routes){
  const code=read(name);
  assert.match(code,/autolikesNewSalesEnabled/);
  const handler=code.indexOf("export async function ");
  const guard=code.indexOf("if(!autolikesNewSalesEnabled())",handler);
  assert.ok(handler>=0&&guard>handler&&guard-handler<260,"guard missing at start of "+name);
  assert.match(code,/checkoutEnabled:false/);
 }
 assert.match(read(prefix+"/prepaid/checkout/route.js"),/type:"sale"/);
 assert.match(read(prefix+"/enroll/route.js"),/nmiAutoLikesCall/);
});
test("public sales page explains pause, has no card fields, and homepage stops advertising",()=>{
 assert.match(page,/New Orders Paused/);
 assert.match(page,/No payments can be started/);
 assert.match(page,/existing order/);
 assert.doesNotMatch(page,/PremiumInlineCheckout|startPaymentRequest|\/api\/autolikes\/prepaid\/checkout/);
 assert.doesNotMatch(storefront,/href="\/autolikes"/);
 assert.doesNotMatch(storefront,/Explore Automatic Likes|litix-autolikes-feature/);
 assert.match(storefront,/id="checkout"/);
 assert.match(storefront,/<LitixQuickShop\/>/);
});
test("existing paid-order tracking and read-only supplier reconciliation remain",()=>{
 const managePage=read("app/autolikes/prepaid/manage/page.jsx");
 const manageApi=read(prefix+"/prepaid/manage/route.js");
 const cron=read(prefix+"/prepaid/cron/route.js");
 const worker=read("lib/litixPrepaidAutoLikesFulfillment.mjs");
 assert.match(managePage,/api\/autolikes\/prepaid\/manage/);
 assert.match(manageApi,/public_token_hash/);
 assert.match(cron,/syncPrepaidAutoLikes/);
 assert.match(worker,/fulfillment_state='SUBMITTED'/);
 assert.doesNotMatch(manageApi,/autolikesNewSalesEnabled/);
 assert.doesNotMatch(cron,/autolikesNewSalesEnabled/);
 assert.doesNotMatch(worker,/autolikesNewSalesEnabled/);
});
