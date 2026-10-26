import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {notifyOwnersOfVerifiedPurchase,OWNER_PURCHASE_RECIPIENTS} from "../lib/ownerPurchaseNotifications.mjs";
import {GROWTH_BUNDLES} from "../lib/growthBundles.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const makeSql=(kind,state)=>{
 const ledger=new Set(),queries=[];
 const order=kind==="bundle"?
  {id:"lbg_12345678-1234-1234-1234-123456789abc",email:"customer@example.test",profile_ref:"@verifiedaccount",platform:"Instagram",package_name:"Instagram Launch",package_items:{Likes:25000,Views:100000,Shares:1000,Followers:5000},price_cents:5382,payment_state:state,order_state:"Awaiting WhatsApp Submission",created_at:"2026-10-26T15:00:00.000Z"}:
  {id:"ltx2_12345678-1234-1234-1234-123456789abc",email:"customer@example.test",service_id:"47403",service_name:"Instagram Followers",destination:"https://instagram.com/example",quantity:1000,amount_cents:699,payment_state:state,fulfillment_state:"submitted",created_at:"2026-10-26T15:00:00.000Z"};
 const sql={query:async(q,args=[])=>{
  queries.push({q,args});
  if(q.startsWith("select id,email"))return state===(kind==="bundle"?"settled":"paid")?[order]:[];
  if(q.startsWith("insert into litix_owner_purchase_notices")){
   const key=args[0]+"|"+args[1];if(ledger.has(key))return [];
   ledger.add(key);return [{order_id:args[0]}];
  }
  if(q.startsWith("update litix_owner_purchase_notices"))return [];
  throw Error("Unexpected SQL "+q);
 }};
 return {sql,ledger,queries,id:order.id};
};
test("both owners get one real-format Resend notification, no duplicate on callbacks",async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.RESEND_API_KEY;
 process.env.RESEND_API_KEY="mock-resend-key";
 const sends=[];
 globalThis.fetch=async(url,args)=>{
  assert.equal(url,"https://api.resend.com/emails");
  sends.push({body:JSON.parse(args.body),headers:args.headers});
  return Response.json({id:"mock-only"});
 };
 try{
  for(const kind of ["bundle","service"]){
   const m=makeSql(kind,kind==="bundle"?"settled":"paid");
   assert.equal(await notifyOwnersOfVerifiedPurchase({sql:m.sql,kind,orderId:m.id}),true);
   assert.equal(await notifyOwnersOfVerifiedPurchase({sql:m.sql,kind,orderId:m.id}),true);
  }
  assert.equal(sends.length,4);
  assert.deepEqual(sends.filter(s=>s.body.subject.includes("Growth Bundle")).map(s=>s.body.to[0]),[...OWNER_PURCHASE_RECIPIENTS]);
  for(const {body,headers} of sends){
   assert.equal(body.from,"Litix <orders@litix.net>");
   assert.match(body.text,/Order ID: .*?\nPurchase date \(UTC\): 2026-10-26T15:00:00.000Z/);
   assert.match(body.text,/Customer email: customer@example.test/);
   assert.match(body.text,/Payment status: (?:paid|settled)/);
   assert.match(body.text,/Fulfillment instructions:/);
   assert.doesNotMatch(body.text,/card number|security code|cvv|payment token/i);
   assert.match(headers["Idempotency-Key"],/^litix-owner-payment\//);
  }
  const bundles=sends.filter(s=>s.body.subject.includes("Growth Bundle"));
  assert.ok(bundles.every(s=>s.body.text.includes("MANUAL FULFILLMENT ONLY")));
  assert.ok(bundles.every(s=>s.body.text.includes("Followers: 5,000")));
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey}
});
test("never notify for unpaid, pending-settlement or declined orders",async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY="mock";
 let requests=0;globalThis.fetch=async()=>{requests++;throw Error("No email may be sent")};
 try{
  for(const [kind,state] of [["bundle","approved_pending_settlement"],["bundle","declined"],["service","processing"],["service","review"]]){
   const m=makeSql(kind,state);
   assert.equal(await notifyOwnersOfVerifiedPurchase({sql:m.sql,kind,orderId:m.id}),false);
   assert.equal(m.ledger.size,0);
  }
  assert.equal(requests,0);
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey}
});
test("manual bundles keep all eight PayKings checkout paths and never call a supplier",()=>{
 const checkout=read("app/api/bundles/checkout/route.js");
 const cron=read("app/api/bundles/cron/route.js");
 const admin=read("app/api/bundles/admin/route.js");
 const bundleLib=read("lib/bundleOrders.mjs");
 const normal=read("app/api/[action]/route.js");
 assert.equal(GROWTH_BUNDLES.length,8);
 for(const p of GROWTH_BUNDLES)assert.ok(["Launch","Momentum","Power","Apex"].includes(p.tier));
 assert.match(checkout,/https:\/\/paykings\.transactiongateway\.com\/api\/transact\.php/);
 assert.match(checkout,/amount:\(pkg\.priceCents\/100\)\.toFixed\(2\)/);
 assert.match(checkout,/on conflict\(idempotency_key\) do nothing/);
 assert.match(checkout,/payment_state='settled'/);
 assert.match(checkout,/verifyNmiSettlement/);
 assert.match(checkout,/sendBundleReceipt\(\{id,email,package_name:pkg.name,price_cents:pkg.priceCents\},sql\)/);
 assert.match(cron,/sendBundleReceipt\(updated\[0\],sql\)/);
 assert.match(admin,/sendBundleReceipt\(updated\[0\],sql\)/);
 assert.match(admin,/process\.env\.LITIX_BUNDLES_ADMIN_TOKEN\|\|process\.env\.ADMIN_SECRET/);
 assert.match(bundleLib,/notifyOwnersOfVerifiedPurchase/);
 assert.doesNotMatch(checkout,/action:["']add["']|smm\(["']add["']/);
 assert.doesNotMatch(cron,/action:["']add["']|smm\(["']add["']/);
 assert.match(admin,/Automated supplier dispatch is disabled/);
 assert.match(admin,/markManualProcessing|markManualCompleted/);
 assert.match(normal,/sendOrderEmails/);
 assert.match(normal,/notifyOwnersOfVerifiedPurchase\(\{sql,kind:"service",orderId\}\)/);
});
