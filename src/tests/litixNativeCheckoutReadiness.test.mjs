import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 nativeCheckoutConfigValid,nativeCheckoutTablesPresent,nativeCheckoutReady
} from "../lib/litixNativeCheckoutReadiness.mjs";
const readyEnv={
 VERCEL_ENV:"production",
 LITIX_NATIVE_PAID_ENABLED:"true",
 LITIX_NATIVE_RELEASE_APPROVAL:"approved-native-pro30-v1",
 LITIX_NATIVE_DATABASE_URL:"postgresql://test-only-not-used",
 NMI_SECURITY_KEY:"test-private-nmi-key-not-live",
 RESEND_API_KEY:"test-resend-not-live",
 LITIX_NATIVE_ORDER_SECRET:"0".repeat(48),
 LITIX_NATIVE_PRICES_JSON:JSON.stringify({
  "litix-native-30day-campaign-pro":{
   priceCents:999,costCents:80,supportReserveCents:150
  }
 })
};
test("Live Native checkout fails closed if any mandatory configuration is absent",()=>{
 assert.equal(nativeCheckoutConfigValid(readyEnv),true);
 const keys=["LITIX_NATIVE_PAID_ENABLED","LITIX_NATIVE_RELEASE_APPROVAL",
  "LITIX_NATIVE_DATABASE_URL","NMI_SECURITY_KEY","RESEND_API_KEY",
  "LITIX_NATIVE_ORDER_SECRET","LITIX_NATIVE_PRICES_JSON"];
 for(const key of keys){
  const next={...readyEnv,[key]:""};
  assert.equal(nativeCheckoutConfigValid(next),false,key);
 }
 assert.equal(nativeCheckoutConfigValid({...readyEnv,VERCEL_ENV:"preview"}),false);
 assert.equal(nativeCheckoutConfigValid({...readyEnv,LITIX_NATIVE_RELEASE_APPROVAL:"unapproved"}),false);
});
test("Pricing and direct-cost margin requirements must be valid",()=>{
 for(const config of [
  "{}","invalid-json",
  JSON.stringify({"litix-native-30day-campaign-pro":{priceCents:300,costCents:250,supportReserveCents:50}}),
  JSON.stringify({"litix-native-caption-kit":{priceCents:999,costCents:0,supportReserveCents:50}})
 ]){
  assert.equal(nativeCheckoutConfigValid({...readyEnv,LITIX_NATIVE_PRICES_JSON:config}),false);
 }
});
test("Missing, broken, or inaccessible Native ledger prevents checkout",async()=>{
 const missing={query:async()=>[{orders_ready:false,outbox_ready:false}]};
 const complete={query:async(sql,params)=>{
  assert.match(sql,/to_regclass/);assert.deepEqual(params,[]);
  return [{orders_ready:true,outbox_ready:true}];
 }};
 const failed={query:async()=>{throw Error("no database");}};
 assert.equal(await nativeCheckoutTablesPresent(missing),false);
 assert.equal(await nativeCheckoutTablesPresent(failed),false);
 assert.equal(await nativeCheckoutTablesPresent(complete),true);
 assert.equal(await nativeCheckoutReady(readyEnv,complete),true);
 assert.equal(await nativeCheckoutReady(readyEnv,missing),false);
 assert.equal(await nativeCheckoutReady({...readyEnv,LITIX_NATIVE_PAID_ENABLED:"false"},complete),false);
});
test("Native premium page actually mounts the protected checkout, without automatic charges",()=>{
 const page=readFileSync(new URL("../app/native/premium/page.jsx",import.meta.url),"utf8");
 const client=readFileSync(new URL("../components/LitixNativePremiumCheckout.jsx",import.meta.url),"utf8");
 assert.match(page,/LitixNativePremiumCheckout/);
 assert.match(page,/<LitixNativePremiumCheckout\/>/);
 assert.match(client,/if\(!active\)return/);
 assert.match(client,/startPaymentRequest/);
 assert.match(client,/https:\/\/secure\.nmi\.com\/token\/Collect\.js/);
 assert.match(client,/submittedRef|lock\.current/);
 assert.match(client,/requestId/);
 assert.doesNotMatch(client,/type="password"/);
});
