import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("existing numeric SMMGLOB IDs still use exactly the original handler",async()=>{
 let supplier=0,boostero=0,payload=null;
 globalThis.__bstRouteMocks={
  checkout:async request=>{supplier++;assert.equal(new URL(request.url).pathname,"/api/checkout");return Response.json({route:"smmglob"})},
  boostero:async request=>{boostero++;payload=await request.json();return Response.json({route:"boostero"})}
 };
 try{
  const text=load("../app/api/checkout/v1/route.js")
   .replace('import { POST as checkout } from "../../[action]/route.js";',
    "const checkout=globalThis.__bstRouteMocks.checkout;")
   .replace('import {handleBoosteroOrder} from "../../../../lib/boosteroOrderHandler.mjs";',
    "const handleBoosteroOrder=globalThis.__bstRouteMocks.boostero;");
  const {POST}=await import("data:text/javascript,"+encodeURIComponent(text));
  const req=s=>new Request("https://www.litix.net/api/checkout/v1",{method:"POST",
   headers:{"content-type":"application/json","origin":"https://www.litix.net"},body:JSON.stringify(s)});
  const old=await POST(req({serviceId:"33553",paymentToken:"placeholder"}));
  assert.equal((await old.json()).route,"smmglob");assert.equal(supplier,1);assert.equal(boostero,0);
  const added=await POST(req({serviceId:"boostero_5461",link:"https://instagram.com/test/",
    paymentToken:"test-card-token",expectedAmountCents:501}));
  assert.equal((await added.json()).route,"boostero");
  assert.equal(boostero,1);assert.equal(supplier,1);
  assert.equal(payload.serviceId,"5461");assert.equal(payload.action,"card_purchase");
  assert.equal(payload.destination,"https://instagram.com/test/");
  assert.equal(payload.paymentToken,"test-card-token");
 }finally{delete globalThis.__bstRouteMocks}
});
test("original storefront markup and customer checkout components are untouched",()=>{
 const a=load("../app/api/[action]/route.js");
 const b=load("../app/api/checkout/v1/route.js");
 const card=load("../components/PremiumInlineCheckout.jsx");
 const catalog=load("../app/api/catalog/v1/route.js");
 assert.match(a,/smm\("add",/);assert.match(a,/security_key:gatewayKey/);
 assert.match(b,/^\s*return checkout\(new Request\(url, request\)\);/m);
 assert.match(b,/^  if\(\/\^boostero_\[0-9\]\{1,12\}\$\/\.test\(id\)\)\{/m);
 assert.match(card,/CollectJS|cardReady|ccnumber/);
 assert.match(catalog,/if\(!original\.ok\|\|process\.env\.LITIX_BOOSTERO_ENABLED!=="true"/);
});
test("standalone supplier tracker is token-gated, not a public diagnostic endpoint",()=>{
 const t=load("../app/api/internal/boostero/track/route.js");
 assert.match(t,/tracking_token_hash/);
 assert.match(t,/hashBoostero\(token\)/);
 assert.doesNotMatch(t,/BOOSTERO_API_KEY/);
});
