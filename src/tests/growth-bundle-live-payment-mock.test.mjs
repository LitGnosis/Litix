import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GROWTH_BUNDLES} from "../lib/growthBundles.mjs";
const original=readFileSync(new URL("../app/api/bundles/checkout/route.js",import.meta.url),"utf8");
const source=original
 .replace('import {growthBundle} from "../../../../lib/growthBundles.mjs";','import {growthBundle} from '+JSON.stringify(new URL("../lib/growthBundles.mjs",import.meta.url).href)+';')
 .replace('import {bundleCheckoutReady} from "../route.js";','const bundleCheckoutReady=async()=>true;')
 .replace('import {bundleDB,hashToken,response,sameOrigin,verifyNmiSettlement,sendBundleReceipt} from "../../../../lib/bundleOrders.mjs";',
  [
    'import {createHash} from "node:crypto";',
    'const hashToken=v=>createHash("sha256").update(String(v)).digest("hex");',
    'const response=(v,s=200)=>Response.json(v,{status:s});',
    'const sameOrigin=req=>req.headers.get("origin")===new URL(req.url).origin;',
    'const bundleDB=()=>globalThis.__litixBundlesTestDatabase;',
    'const verifyNmiSettlement=async args=>{globalThis.__litixBundleVerify.push(args);return {settled:true}};',
    'const sendBundleReceipt=async(o,sql)=>{globalThis.__litixBundleMail.push({o,sql});return true};'
  ].join("\n"));

test("all eight Growth Bundles use live PayKings sale format, persist settlement and never dispatch suppliers",async()=>{
 const oldFetch=globalThis.fetch,oldDB=globalThis.__litixBundlesTestDatabase;
 const oldVerify=globalThis.__litixBundleVerify,oldMail=globalThis.__litixBundleMail;
 const payments=[],queries=[],keys=new Set();
 const sql={query:async(text,values)=>{
  queries.push({text,values});
  if(text.includes("insert into litix_growth_bundle_orders")){
   if(keys.has(values[7]))return [];keys.add(values[7]);return [{id:values[0]}];
  }
  return [{id:values?.[0]||"test"}];
 }};
 globalThis.__litixBundlesTestDatabase=sql;globalThis.__litixBundleVerify=[];globalThis.__litixBundleMail=[];
 globalThis.fetch=async(url,opts)=>{
  assert.equal(String(url),"https://paykings.transactiongateway.com/api/transact.php");
  assert.equal(opts.body.get("type"),"sale");
  payments.push(Object.fromEntries(opts.body));
  return new Response("response=1&response_code=100&transactionid=12345678");
 };
 try{
  const {POST}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
  for(let i=0;i<GROWTH_BUNDLES.length;i++){
   const pkg=GROWTH_BUNDLES[i],idem="00000000-0000-4000-8000-"+String(i).padStart(12,"0");
   const request=()=>new Request("https://litix.net/api/bundles/checkout",{
    method:"POST",headers:{origin:"https://litix.net"},
    body:JSON.stringify({packageId:pkg.id,expectedAmountCents:pkg.priceCents,email:"test@example.test",
      profile:"@testprofile",paymentToken:"fake-collectjs-token",idempotencyKey:idem,whatsappConsent:true})});
   const result=await POST(request()),data=await result.json();
   assert.equal(result.status,200);
   assert.equal(data.payment,"settled");
   assert.equal(data.status,"Awaiting WhatsApp Submission");
   assert.equal(payments[i].amount,(pkg.priceCents/100).toFixed(2));
   assert.equal(payments[i].order_description,pkg.name);
   assert.ok(payments[i].orderid.startsWith("lbg_"));
   assert.equal((await POST(request())).status,409);
  }
  assert.equal(payments.length,8);
  assert.equal(globalThis.__litixBundleVerify.length,8);
  assert.equal(globalThis.__litixBundleMail.length,8);
  assert.equal(queries.filter(x=>x.text.includes("payment_state='settled'")).length,8);
  assert.equal(queries.filter(x=>x.text.includes("on conflict(idempotency_key) do nothing")).length,16);
 }finally{
  globalThis.fetch=oldFetch;globalThis.__litixBundlesTestDatabase=oldDB;
  globalThis.__litixBundleVerify=oldVerify;globalThis.__litixBundleMail=oldMail;
 }
});
