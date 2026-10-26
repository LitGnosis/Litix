import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GROWTH_BUNDLES,growthBundle} from "../lib/growthBundles.mjs";
const source=readFileSync(new URL("../app/api/bundles/checkout/route.js",import.meta.url),"utf8")
 .replace('import {growthBundle} from "../../../../lib/growthBundles.mjs";',
 'const growthBundle=globalThis.__bundleMockLookup;')
 .replace('import {bundleCheckoutReady} from "../route.js";',
 'const bundleCheckoutReady=async()=>true;')
 .replace('import {bundleDB,hashToken,response,sameOrigin,verifyNmiSettlement,sendBundleReceipt} from "../../../../lib/bundleOrders.mjs";',
 'const bundleDB=()=>({query:globalThis.__bundleMockDB});const hashToken=()=>"mock-hash";const response=(v,status=200)=>Response.json(v,{status});const sameOrigin=()=>true;const verifyNmiSettlement=async input=>{globalThis.__bundleMockVerified.push(input);return {settled:true}};const sendBundleReceipt=async order=>{globalThis.__bundleMockReceipts.push(order);return true};');
test("all eight fixed-price bundles record verified paid orders in mocked PayKings checkout without charging a card",async t=>{
 const oldFetch=globalThis.fetch,oldDB=globalThis.__bundleMockDB,oldLookup=globalThis.__bundleMockLookup;
 const keys=["NMI_SECURITY_KEY"];const originals=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.NMI_SECURITY_KEY="unit-test-only";
 const gateway=[],inserted=[],updated=[],receipts=[],verified=[];
 globalThis.__bundleMockLookup=growthBundle;
 globalThis.__bundleMockReceipts=receipts;
 globalThis.__bundleMockVerified=verified;
 globalThis.__bundleMockDB=async (query,args=[])=>{
  if(query.startsWith("insert into litix_growth_bundle_orders")){
   inserted.push({sql:query,params:args});return [{id:args[0]}];
  }
  if(query.includes("set payment_state='settled'")){
   updated.push({sql:query,params:args});
   const row=inserted.find(x=>x.params[0]===args[0]);
   const pkg=growthBundle(row.params[2]);
   return [{id:args[0],email:row.params[1],package_id:pkg.id,package_name:pkg.name,
    package_items:pkg.items,price_cents:pkg.priceCents,profile_ref:row.params[9],created_at:"2026-10-26T19:00:00Z"}];
  }
  return [];
 };
 globalThis.fetch=async(url,init)=>{
  assert.equal(url,"https://paykings.transactiongateway.com/api/transact.php");
  assert.equal(init.method,"POST");
  assert.equal(init.body.get("type"),"sale");
  assert.equal(init.body.get("payment_token"),"safe-mock-token-not-real");
  gateway.push({amount:init.body.get("amount"),orderId:init.body.get("orderid")});
  return new Response("response=1&response_code=100&transactionid=123456789");
 };
 t.after(()=>{
  globalThis.fetch=oldFetch;
  if(oldDB===undefined)delete globalThis.__bundleMockDB;else globalThis.__bundleMockDB=oldDB;
  if(oldLookup===undefined)delete globalThis.__bundleMockLookup;else globalThis.__bundleMockLookup=oldLookup;
  delete globalThis.__bundleMockReceipts;delete globalThis.__bundleMockVerified;
  for(const k of keys){if(originals[k]===undefined)delete process.env[k];else process.env[k]=originals[k]}
 });
 const {POST}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
 for(const bundle of GROWTH_BUNDLES){
  const response=await POST(new Request("https://www.litix.net/api/bundles/checkout",{
   method:"POST",headers:{"origin":"https://www.litix.net","content-type":"application/json"},
   body:JSON.stringify({packageId:bundle.id,email:"buyer@example.test",profile:"@creator",
    paymentToken:"safe-mock-token-not-real",idempotencyKey:"12345678-1234-4234-8234-123456789abc",
    expectedAmountCents:bundle.priceCents,whatsappConsent:true})
  }));
  assert.equal(response.status,200,bundle.id);
  const body=await response.json();
  assert.equal(body.payment,"settled",bundle.id);
  assert.equal(body.status,"Awaiting WhatsApp Submission",bundle.id);
  assert.equal(receipts.at(-1).package_id,bundle.id);
  assert.equal(verified.at(-1).orderId,body.orderId);
  assert.equal(verified.at(-1).priceCents,bundle.priceCents);
  assert.equal(inserted.at(-1).params[2],bundle.id);
  assert.equal(inserted.at(-1).params[5],bundle.priceCents);
  assert.equal(gateway.at(-1).amount,(bundle.priceCents/100).toFixed(2));
  assert.ok(updated.at(-1).sql.includes("payment_state='approved_pending_settlement'"));
 }
 assert.equal(gateway.length,8);
 assert.equal(inserted.length,8);
 assert.equal(updated.length,8);
 assert.equal(receipts.length,8);
 assert.equal(verified.length,8);
});
