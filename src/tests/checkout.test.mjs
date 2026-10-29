import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
// Legacy numeric supplier checkout is retired. Preserve no-charge regression
// coverage without asserting obsolete SMMGLOB transaction success statuses.
const source=readFileSync(new URL("../app/api/[action]/route.js",import.meta.url),"utf8")
 .replace('import { after } from "next/server";','const after=()=>{};')
 .replace('import { sendOrderEmails, notificationsConfigured } from "../../../lib/orderNotifications.mjs";','const sendOrderEmails=async()=>true;const notificationsConfigured=()=>false;')
 .replace('"../../../lib/pricing.mjs"',JSON.stringify(new URL("../lib/pricing.mjs",import.meta.url).href))
 .replace('"../../../lib/catalogSort.mjs"',JSON.stringify(new URL("../lib/catalogSort.mjs",import.meta.url).href))
 .replace('import { neon } from "@neondatabase/serverless";','const neon=()=>{throw Error("legacy checkout database must not be accessed")};');
const retired=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
for(const id of ["1","5461","4751","33588","99999","boostero_5461","","bad","../etc/passwd"]){
 test("legacy checkout refuses payment and supplier network ("+id+")",async()=>{
  const oldFetch=globalThis.fetch;
  let network=0;
  globalThis.fetch=async()=>{network++;throw Error("Unexpected payment/supplier network call");};
  try{
   const res=await retired.POST(new Request("https://example.test/api/checkout",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({serviceId:id,quantity:1000,email:"test@example.com",
     link:"https://www.instagram.com/test/",paymentToken:"never-use-token",expectedAmountCents:999,
     idempotencyKey:"00000000-0000-0000-0000-000000000000"})
   }));
   assert.equal(res.status,409);
   assert.match((await res.json()).error,/retired supplier checkout.*disabled|approved Boostero service/i);
   assert.equal(network,0);
  }finally{globalThis.fetch=oldFetch}
 });
}
test("retired checkout rejects even malformed body before processing payment",async()=>{
 const r=await retired.POST(new Request("https://example.test/api/checkout",{method:"POST",body:"not-json"}));
 assert.equal(r.status,409);
});
test("Boostero-only v1 checkout route retains fail-closed service ID validation",()=>{
 const route=readFileSync(new URL("../app/api/checkout/v1/route.js",import.meta.url),"utf8");
 assert.match(route,/handleBoosteroOrder/);
 assert.match(route,/Only verified Boostero services are available/);
 assert.match(route,/No charge attempted/);
 assert.doesNotMatch(route,/smmglob\.com|smmfollowom/i);
});
