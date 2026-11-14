import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {sendOrderEmails} from "../lib/orderNotifications.mjs";
import {prepaidAutoLikesMessages} from "../lib/litixPrepaidAutoLikesEmails.mjs";

const source=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const vendorRe=/\b(?:Boostero|SMMGLOB|SMMFOLLOWOM)\b/i;

test("actual customer receipts, tracking emails and owner notification stay Litix branded",async()=>{
 const originalFetch=globalThis.fetch,originalKey=process.env.RESEND_API_KEY;
 const sent=[];
 process.env.RESEND_API_KEY="test-only-no-real-sends";
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,"https://api.resend.com/emails");
  sent.push(JSON.parse(options.body));
  return new Response(null,{status:202});
 };
 try{
  const sentOk=await sendOrderEmails({
   orderId:"ltx2_11111111-1111-4111-8111-111111111111",
   secret:"totally_fake_private_token_12345678901234567890",
   email:"test.customer@example.com",amountCents:424,quantity:1000,
   serviceName:"Boostero Top Pick | Instagram Real Followers",
   fulfillment:"submitted",notifyOwner:true
  });
  assert.equal(sentOk,true);
  assert.equal(sent.length,3);
  for(const item of sent){
   assert.doesNotMatch(item.subject,vendorRe);
   assert.doesNotMatch(item.text,vendorRe);
   assert.doesNotMatch(item.html||"",vendorRe);
   assert.doesNotMatch(item.text,/Supplier status:|Boostero Order ID|Supplier: Boostero/i);
  }
  const customer=sent.filter(item=>item.to.includes("test.customer@example.com"));
  assert.equal(customer.length,2);
  for(const item of customer){
   assert.match(item.text,/Delivery status:/);
   assert.doesNotMatch(item.text,/supplier processing/i);
  }
  const owner=sent.find(item=>item.to.includes("litgnosisllc@gmail.com"));
  assert.ok(owner);
 }finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY=originalKey;
 }
});

test("Boostero order notice includes supplier IDs only in internal database logic, never in emails",async()=>{
 const full=await source("lib/boosteroFulfillment.mjs");
 const start=full.indexOf(" const customerBody=[");
 const end=full.indexOf(" if(secret&&o.payment_state",start);
 assert.ok(start>=0&&end>start);
 const notice=full.slice(start,end);
 assert.match(notice,/const ownerBody=/);
 assert.match(notice,/const customerBody=/);
 assert.doesNotMatch(notice,/Supplier: Boostero|Boostero Order ID|Owner order submitted to Boostero/);
 assert.doesNotMatch(notice,/supplier_order_id/);
 assert.doesNotMatch(notice,/Boostero child statuses/);
 assert.match(notice,/Litix fulfillment reference/);
 assert.match(full,/f\.supplier_order_id/);
 assert.match(full,/subject=reviewRequired\?/);
});

test("public tracking and status API do not expose the supplier ID or vendor brand",async()=>{
 const api=await source("app/api/[action]/route.js");
 const first=api.indexOf("const publicOrder=");
 const last=api.indexOf("async function refreshSupplierOrder",first);
 const serializer=api.slice(first,last);
 assert.ok(first>=0&&last>first);
 assert.doesNotMatch(serializer,/supplierOrderId|supplier_order_id/);
 assert.match(serializer,/publicServiceCardName/);
 assert.doesNotMatch(serializer,/Showing the last saved Boostero status/);
 const health=await source("app/api/status/route.js");
 assert.doesNotMatch(health,/supplier: "Boostero"/);
 assert.match(health,/fulfillment: "Litix"/);
});

test("prepaid customer tracking notice never says supplier or vendor",()=>{
 const messages=prepaidAutoLikesMessages({
  email:"test.customer@example.com",
  portal:"https://www.litix.net/autolikes/prepaid/manage?token=public-test-only-123456789",
  orderId:"alp_11111111-1111-4111-8111-111111111111",
  amountCents:424,posts:3,likes:1000,platform:"Instagram",fulfillment:"processing"
 });
 assert.equal(messages.length,3);
 for(const item of messages.filter(x=>x.kind!=="owner")){
  assert.doesNotMatch(item.text,vendorRe);
  assert.doesNotMatch(item.text,/supplier\s+(?:monitoring|availability)/i);
  assert.match(item.text,/Litix/i);
 }
});
