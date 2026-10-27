import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GROWTH_BUNDLES,growthBundle} from "../lib/growthBundles.mjs";
import {BLUEVINE_BUNDLE_LINKS,bluevineBundleLink} from "../lib/bluevineBundles.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const expected={
 launch:["https://pay.bluevine.com/p/ecd2c080f8a74e33ac834ed0e9eedc92",5382],
 momentum:["https://pay.bluevine.com/p/23d4ce5549c846b6b50dd4ce233b7723",10782],
 power:["https://pay.bluevine.com/p/5583a248578d48649bb5151c76eb7d4d",19782],
 apex:["https://pay.bluevine.com/p/ae9473e7c1d44aa6bbed123843d945c5",35982]
};
test("four immutable Bluevine URLs map to both Instagram and TikTok tiers with unchanged prices",()=>{
 assert.equal(GROWTH_BUNDLES.length,8);
 assert.equal(Object.keys(BLUEVINE_BUNDLE_LINKS).length,4);
 for(const [tier,[url,cents]] of Object.entries(expected)){
  assert.equal(BLUEVINE_BUNDLE_LINKS[tier],url);
  assert.equal(new URL(url).origin,"https://pay.bluevine.com");
  for(const platform of ["ig","tt"]){
   const pkg=growthBundle(platform+"_"+tier);
   assert.equal(pkg.priceCents,cents);
   assert.equal(bluevineBundleLink(pkg),url);
  }
 }
 assert.equal(bluevineBundleLink(null),null);
});
test("Bluevine redirects only after a server-saved UNPAID order, never after a return URL",()=>{
 const route=read("app/api/bundles/bluevine/route.js");
 const cards=read("components/GrowthBundles.jsx");
 const ui=read("app/bundles/checkout/page.jsx");
 const ready=read("app/api/bundles/route.js");
 const schema=read("db/migrations/20261026-bluevine-bundle-pending-orders.sql");
 assert.match(route,/on conflict\(idempotency_key\) do nothing/);
 assert.match(route,/awaiting_payment/);
 assert.match(route,/sameOrigin\(req\)/);
 assert.match(route,/expectedAmountCents!==pkg.priceCents/);
 assert.match(route,/bluevineBundleLink\(pkg\)/);
 assert.doesNotMatch(route,/payment_state='settled'|transactiongateway.com|smmglob.com/);
 assert.match(cards,/Pay with Bluevine/);
 assert.match(cards,/bluevineEnabled/);
 assert.match(ui,/sessionStorage.setItem\("litix:bundle-confirmation"/);
 assert.match(ui,/sessionStorage.setItem\("litix:bundle-bluevine-pending"/);
 assert.match(ui,/location.assign\(d.checkoutUrl\)/);
 assert.match(ui,/d.checkoutUrl!==bluevineBundleLink\(pkg\)/);
 assert.match(ui,/type="tel" required/);
 assert.match(ui,/up to 10 post links or screenshots/);
 assert.match(ready,/LITIX_BLUEVINE_LINKS_VERIFIED/);
 assert.match(ready,/bluevineEnabled:bluevineReady/);
 assert.match(schema,/payment_provider/);
});
test("Only authorized owner manually verifies the actual Bluevine transaction; notifications remain settled-only",()=>{
 const admin=read("app/api/bundles/admin/route.js");
 const ui=read("app/bundles/admin/page.jsx");
 const tracking=read("app/bundles/confirmation/page.jsx");
 assert.match(admin,/authorized\(req\)/);
 assert.match(admin,/confirmBluevinePayment/);
 assert.match(admin,/data.verifiedInBluevine!==true/);
 assert.match(admin,/data.confirmedAmountCents!==Number\(order.price_cents\)/);
 assert.match(admin,/payment_provider='bluevine' and payment_state='awaiting_payment'/);
 assert.match(admin,/sendBundleReceipt\(verified\[0\]\)/);
 assert.match(ui,/Confirm verified Bluevine payment/);
 assert.match(ui,/customer_whatsapp/);
 assert.match(tracking,/NOT marked paid/);
 assert.match(tracking,/data.order.paymentProvider==="bluevine"/);
});
test("The existing PayKings bundle checkout and regular storefront checkout remain present",()=>{
 const old=read("app/api/bundles/checkout/route.js");
 const page=read("app/bundles/checkout/page.jsx");
 const regular=read("app/api/[action]/route.js");
 assert.match(old,/https:\/\/paykings.transactiongateway.com\/api\/transact.php/);
 assert.match(old,/verifyNmiSettlement/);
 assert.match(page,/PayKings/);
 assert.match(page,/collect\(\).startPaymentRequest\(\)/);
 assert.match(regular,/paykings.transactiongateway.com\/api\/transact.php/);
});
test("Bluevine API must refuse all checkout redirects until links are independently verified",async()=>{
 const prior=process.env.LITIX_BLUEVINE_LINKS_VERIFIED;
 delete process.env.LITIX_BLUEVINE_LINKS_VERIFIED;
 try{
  const {POST}=await import("../app/api/bundles/bluevine/route.js");
  const req=new Request("https://www.litix.net/api/bundles/bluevine",{
   method:"POST",headers:{"origin":"https://www.litix.net","content-type":"application/json"},
   body:JSON.stringify({packageId:"ig_launch",expectedAmountCents:5382})});
  const res=await POST(req);
  assert.equal(res.status,503);
  assert.match((await res.json()).error,/not yet verified/);
 }finally{
  if(prior===undefined)delete process.env.LITIX_BLUEVINE_LINKS_VERIFIED;
  else process.env.LITIX_BLUEVINE_LINKS_VERIFIED=prior;
 }
});

test("new unpaid Bluevine orders alert both owners and customer, never claim successful payment",async t=>{
 const {notifyBluevineOrderPending}=await import("../lib/bluevineNotifications.mjs");
 const oldKey=process.env.RESEND_API_KEY,oldFetch=globalThis.fetch;
 process.env.RESEND_API_KEY="test-only-not-live";
 const notices=[];
 globalThis.fetch=async(url,init)=>{
  assert.equal(url,"https://api.resend.com/emails");
  const message=JSON.parse(init.body);
  notices.push({message,key:init.headers["Idempotency-Key"]});
  assert.doesNotMatch(init.body,/card_number|cvv|payment_token|security_key/);
  return Response.json({id:"mock"});
 };
 t.after(()=>{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;});
 const result=await notifyBluevineOrderPending({
  orderId:"lbg_12345678-1234-4234-8234-123456789abc",
  email:"buyer@example.test",phone:"+12145550100",profile:"@testingcreator",trackingToken:"secret-for-test",
  packageName:"Instagram Launch Growth Bundle",packageId:"ig_launch",priceCents:5382,createdAt:"2026-10-26T22:00:00Z"});
 assert.deepEqual(result,{owner:true,customer:true});
 assert.equal(notices.length,2);
 assert.deepEqual(notices[0].message.to,["litixsocial@gmail.com","litgnosisllc@gmail.com"]);
 assert.deepEqual(notices[1].message.to,["buyer@example.test"]);
 assert.match(notices[0].message.text,/NOT A PAID ORDER/);
 assert.match(notices[0].message.text,/12145550100/);
 assert.match(notices[1].message.text,/AWAITING PAYMENT VERIFICATION/);
 assert.match(notices[1].message.text,/up to 10 post links or screenshots/);
 assert.match(notices[1].message.text,/token=secret-for-test/);
 assert.match(notices[1].message.text,/litixsocial@gmail.com/);
 assert.match(notices[1].message.text,/instagram.com\/litixsocial/);
 assert.notEqual(notices[0].key,notices[1].key);
});
