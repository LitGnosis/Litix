import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sendOrderEmails} from "../lib/orderNotifications.mjs";
import {sendBundleReceipt} from "../lib/bundleOrders.mjs";
import {sendOwnerPurchaseNotification} from "../lib/ownerNotifications.mjs";
const id="12345678-1234-4234-8234-123456789abc";
function mockedEmails(t){
 const original=globalThis.fetch,old=process.env.RESEND_API_KEY;
 process.env.RESEND_API_KEY="test-only-not-a-real-key";
 const messages=[];
 globalThis.fetch=async(url,request)=>{
  assert.equal(url,"https://api.resend.com/emails");
  const data=JSON.parse(request.body);
  assert.ok(!/card_number|cvv|cvc|payment_token|security_key|pan\b/i.test(request.body),"Card data not emailed");
  messages.push({data,key:request.headers["Idempotency-Key"]});
  return Response.json({id:"mock-only"});
 };
 t.after(()=>{globalThis.fetch=original;if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old});
 return messages;
}
test("standard paid order alerts both owners, retains both customer emails, and excludes card data",async t=>{
 const messages=mockedEmails(t);
 assert.equal(await sendOrderEmails({
  orderId:"ltx2_"+id,secret:id+"-"+id,email:"buyer@example.test",
  serviceName:"Instagram Followers",quantity:1000,amountCents:899,fulfillment:"submitted",
  destination:"https://instagram.com/test/",purchaseDate:"2026-10-26T19:00:00Z"
 }),true);
 assert.equal(messages.length,3);
 assert.deepEqual(messages[2].data.to,["litixsocial@gmail.com","litgnosisllc@gmail.com"]);
 assert.equal(messages[2].key,"litix-owner-confirmed/ltx2_"+id);
 for(const m of messages.slice(0,2))assert.deepEqual(m.data.to,["buyer@example.test"]);
 assert.match(messages[2].data.text,/Purchase date \(UTC\): 2026-10-26/);
 assert.match(messages[2].data.text,/USD \$8\.99/);
});
test("manual customer resend never duplicates the owner alert",async t=>{
 const messages=mockedEmails(t);
 await sendOrderEmails({orderId:"ltx2_"+id,secret:id+"-"+id,email:"buyer@example.test",serviceName:"Instagram Likes",quantity:1000,amountCents:899,fulfillment:"submitted",notifyOwner:false});
 assert.equal(messages.length,2);
});
test("all eight bundle tiers use PayKings and notify owner only on first settled transition",async t=>{
 const messages=mockedEmails(t);
 const pkg=await import("../lib/growthBundles.mjs");
 assert.equal(pkg.GROWTH_BUNDLES.length,8);
 const order={id:"lbg_"+id,package_id:"ig_launch",package_name:"Instagram Launch Growth Bundle",
  email:"buyer@example.test",profile_ref:"@creator",price_cents:5382,
  created_at:"2026-10-26T19:00:00Z"};
 assert.equal(await sendBundleReceipt(order),true);
 assert.equal(messages.length,2);
 const owner=messages.find(x=>x.data.to.length===2);
 assert.ok(owner);
 assert.match(owner.data.text,/MANUAL FULFILLMENT ONLY/);
 assert.match(owner.data.text,/Likes: 25,000/);
 assert.match(owner.data.text,/Followers: 5,000/);
 assert.match(owner.data.text,/Payment status: settled/);
 assert.match(messages.find(x=>x.data.to.length===1).data.text,/Tracking:/);
 const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const checkout=read("app/api/bundles/checkout/route.js"),
  cron=read("app/api/bundles/cron/route.js"),
  admin=read("app/api/bundles/admin/route.js");
 assert.match(checkout,/paykings\.transactiongateway\.com\/api\/transact\.php/);
 assert.match(checkout,/verifyNmiSettlement/);
 assert.match(checkout,/if\(settledRows\.length\)await sendBundleReceipt/);
 assert.match(cron,/payment_state='approved_pending_settlement' returning/);
 assert.match(admin,/payment_state='approved_pending_settlement' returning/);
 for(const x of [checkout,cron,admin])assert.doesNotMatch(x,/action:\s*["']add["']/);
});
test("unverified or declined transactions never send an owner paid notification",async t=>{
 const messages=mockedEmails(t);
 for(const state of ["approved_pending_settlement","declined","review"])assert.equal(
  await sendOwnerPurchaseNotification({orderId:"lbg_"+id,customerEmail:"buyer@example.test",amountCents:5382,paymentStatus:state}),false);
 assert.equal(messages.length,0);
});
