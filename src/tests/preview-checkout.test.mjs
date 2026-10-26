import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8");
const code=file
 .replace('"../../../lib/pricing.mjs"',JSON.stringify(new URL("../lib/pricing.mjs",import.meta.url).href))
 .replace('"../../../lib/catalogSort.mjs"',JSON.stringify(new URL("../lib/catalogSort.mjs",import.meta.url).href))
 .replace('"../../../lib/ownerPurchaseNotifications.mjs"',JSON.stringify(new URL("../lib/ownerPurchaseNotifications.mjs",import.meta.url).href))
 .replace('import { neon } from "@neondatabase/serverless";','const neon=()=>({query:async()=>[]});')
 .replace('import { after } from "next/server";','const after=()=>{};')
 .replace('import { sendOrderEmails, notificationsConfigured } from "../../../lib/orderNotifications.mjs";','const sendOrderEmails=async()=>true; const notificationsConfigured=()=>false;');
test("preview cannot charge through production PayKings credentials",async()=>{
 const saved=Object.fromEntries(["VERCEL_ENV","NMI_GATEWAY_MODE","NMI_SECURITY_KEY","PAYKINGS_NMI_COLLECT_PUBLIC_KEY","SMMGLOB_API_KEY","DATABASE_URL","NMI_TEST_SECURITY_KEY","NMI_TEST_GATEWAY_URL","NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY","NMI_TEST_COLLECT_PUBLIC_KEY"].map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;let outbound=0;
 try{
  Object.assign(process.env,{VERCEL_ENV:"preview",NMI_GATEWAY_MODE:"PRODUCTION",NMI_SECURITY_KEY:"mock-live-private",PAYKINGS_NMI_COLLECT_PUBLIC_KEY:"mock-live-public",SMMGLOB_API_KEY:"mock-supplier",DATABASE_URL:"test-only"});
  for(const k of ["NMI_TEST_SECURITY_KEY","NMI_TEST_GATEWAY_URL","NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY","NMI_TEST_COLLECT_PUBLIC_KEY"])delete process.env[k];
  globalThis.fetch=async()=>{outbound++;throw Error("Unexpected network connection")};
  const mod=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
  const cfg=await mod.GET(new Request("https://example.test/api/config"));
  assert.equal(cfg.status,200);const result=await cfg.json();
  assert.equal(result.ready,false);assert.equal(result.publicKey,null);
  const denied=await mod.POST(new Request("https://example.test/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({serviceId:"33588",quantity:1000,email:"test@example.com",link:"https://instagram.com/test",paymentToken:"mock-only",idempotencyKey:"00000000-0000-0000-0000-000000000000",expectedAmountCents:699})}));
  assert.equal(denied.status,503);
  assert.match(JSON.stringify(await denied.json()),/checkout is temporarily unavailable/i);
  assert.equal(outbound,0);
 }finally{
  for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}
  globalThis.fetch=originalFetch;
 }
});
