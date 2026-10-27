import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,createSign,randomBytes} from "node:crypto";
import {ownerConfig,seal,unseal,createOwnerLoginFlow,challenge,validateFlow,ownerSession,ownerRequest,verifyOwnerIdToken} from "../lib/ownerAuth.mjs";
import {normalizeWholesaleRows,wholesaleQuote,ownerProfile,ownerSupplierAPI} from "../lib/ownerWholesale.mjs";
import {ownerPurchasesEnabled,ownerCardEnabled,ownerCreateOrder,dispatchOwnerOrder} from "../lib/ownerWholesaleOrders.mjs";

const keys=["AUTH0_DOMAIN","AUTH0_CLIENT_ID","AUTH0_CLIENT_SECRET","AUTH0_SECRET","LITIX_OWNER_AUTH0_SUB","LITIX_OWNER_ALLOWED_ORIGIN","LITIX_OWNER_WHOLESALE_PURCHASES","LITIX_OWNER_PAYKINGS_ENABLED","LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED","VERCEL_ENV","SMMGLOB_API_KEY","SMMGLOB_API_URL","RESEND_API_KEY"];
const save=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
function configured(){
 Object.assign(process.env,{AUTH0_DOMAIN:"litix-testing.auth0.com",AUTH0_CLIENT_ID:"fake-public-client",
  AUTH0_CLIENT_SECRET:"fake-server-only",AUTH0_SECRET:"fake-unit-secret-longer-than-32-characters-for-hmac",
  LITIX_OWNER_AUTH0_SUB:"auth0|exact_owner_123",LITIX_OWNER_ALLOWED_ORIGIN:"https://preview.litix.net",
  VERCEL_ENV:"preview",LITIX_OWNER_WHOLESALE_PURCHASES:"false"});
}
function restore(){for(const [key,value] of Object.entries(save)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
test("owner identity is exact Auth0 sub, server signature and same-origin; spoofed headers/toggles cannot authorize",()=>{
 configured();try{
  const flow=createOwnerLoginFlow(),sealed=seal(flow,"flow");
  assert.ok(challenge(flow.verifier).length>=40);
  assert.ok(validateFlow(sealed,flow.state));
  assert.equal(validateFlow(sealed,"invalid-state"),null);
  const now=Math.floor(Date.now()/1000);
  const session=seal({sub:"auth0|exact_owner_123",iat:now,exp:now+1800},"session");
  assert.equal(ownerSession(session).sub,"auth0|exact_owner_123");
  assert.equal(ownerSession(session.slice(0,-1)+"Z"),null);
  assert.equal(ownerSession(seal({sub:"auth0|not_owner",iat:now,exp:now+1800},"session")),null);
  assert.equal(ownerRequest(new Request("https://preview.litix.net/api/owner/wholesale",
   {headers:{"x-owner-role":"owner","x-authenticated-user-id":"auth0|exact_owner_123"}})),null);
  assert.equal(ownerRequest(new Request("https://preview.litix.net/api/owner/wholesale",
   {headers:{"cookie":"__Host-litix-wholesale-session="+session}})).sub,"auth0|exact_owner_123");
  delete process.env.LITIX_OWNER_AUTH0_SUB;
  assert.equal(ownerSession(session),null);
 }finally{restore()}
});
test("auth0 id_token validates RS256 JWKS signature, audience, nonce and exact owner sub",async()=>{
 configured();try{
  const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
  const jwk=publicKey.export({format:"jwk"});Object.assign(jwk,{kid:"key-1",use:"sig",alg:"RS256"});
  const cfg=ownerConfig(),nonce="nonce-for-test",now=Math.floor(Date.now()/1000);
  const make=claims=>{
   const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"key-1"})).toString("base64url");
   const body=Buffer.from(JSON.stringify(claims)).toString("base64url");
   const source=header+"."+body;
   return source+"."+createSign("RSA-SHA256").update(source).end().sign(privateKey).toString("base64url");
  };
  const good={iss:cfg.issuer,aud:cfg.client,sub:cfg.sub,nonce,iat:now,exp:now+1800};
  const fetcher=async()=>Response.json({keys:[jwk]});
  assert.equal((await verifyOwnerIdToken(make(good),cfg,nonce,{fetcher})).sub,cfg.sub);
  for(const changed of [{...good,sub:"auth0|attacker"},{...good,nonce:"wrong"},{...good,aud:"other-client"},{...good,exp:now-1}]){
   await assert.rejects(verifyOwnerIdToken(make(changed),cfg,nonce,{fetcher}),/owner_identity_denied/);
  }
  const bad=make(good).slice(0,-5)+"fake1";
  await assert.rejects(verifyOwnerIdToken(bad,cfg,nonce,{fetcher}),/invalid_id_signature/);
 }finally{restore()}
});
test("actual supplier wholesale catalog returns only matching Instagram Followers and keeps refill metadata",()=>{
 const rows=normalizeWholesaleRows("boostero",[
  {service:5461,name:"Instagram Followers No Refill High Quality",category:"Instagram",rate:"3.00",min:"10",max:"5000",refill:false},
  {service:5470,name:"Instagram Followers 30 days refill 10k/day",category:"Instagram Followers",rate:"4.10",min:"100",max:"100000",refill:false},
  {service:1001,name:"TikTok Followers",category:"TikTok",rate:"1",min:"10",max:"1000"},
  {service:1002,name:"Instagram Likes",category:"Instagram",rate:"1",min:"10",max:"1000"}
 ]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].id,"5461");assert.equal(rows[0].pricePer1000,3);
 assert.equal(rows[0].refillEligible,false);assert.equal(rows[1].refillDays,30);
 assert.equal(rows[1].refillEligible,false);assert.match(rows[1].refillMethod,/advertised/);
 assert.equal(wholesaleQuote(rows[0],1000).costCents,300);
 assert.throws(()=>wholesaleQuote(rows[0],5001),/quantity_invalid/);
 assert.equal(ownerProfile("@litixsocial"),"https://www.instagram.com/litixsocial/");
 for(const profile of ["https://instagram.com.evil.example/owner","https://instagram.com/p/SHORTCODE/","http://instagram.com/owner","https://instagram.com/owner?flag=1"])
  assert.equal(ownerProfile(profile),null);
});
test("owner add requires production purchase enablement AND a durable claim, with no unapproved network requests",async()=>{
 configured();try{
  process.env.SMMGLOB_API_KEY="fake-secret-never-log";
  await assert.rejects(ownerSupplierAPI("smmglob","add",{service:"123",quantity:1000,link:"https://www.instagram.com/test/"},{oneTimeLocked:true,fetcher:async()=>{throw Error("network must stay locked")}}),/owner_purchases_disabled/);
  process.env.LITIX_OWNER_WHOLESALE_PURCHASES="true";
  process.env.VERCEL_ENV="production";
  await assert.rejects(ownerSupplierAPI("smmglob","add",{service:"123",quantity:1000,link:"https://www.instagram.com/test/"},{fetcher:async()=>{throw Error("network not allowed")}}),/unlocked_supplier_purchase_denied/);
  await assert.rejects(ownerSupplierAPI("smmglob","refill",{order:"123"},{fetcher:async()=>{throw Error("network not allowed")}}),/supplier_action_denied/);
  const payloads=[];
  const fetcher=async(url,options)=>{payloads.push({url:url.href,body:new URLSearchParams(options.body)});return Response.json({order:123456})};
  const order=await ownerSupplierAPI("smmglob","add",{service:"123",quantity:1000,link:"https://www.instagram.com/test/"},{oneTimeLocked:true,fetcher});
  assert.equal(order.order,123456);assert.equal(payloads.length,1);
  assert.equal(payloads[0].body.get("action"),"add");assert.equal(payloads[0].body.get("key"),"fake-secret-never-log");
 }finally{restore()}
});
test("real owner orders remain blocked without an Auth0-authorized production release and gateway price configuration",async()=>{
 configured();try{
  assert.equal(ownerPurchasesEnabled(),false);assert.equal(ownerCardEnabled(),false);
  await assert.rejects(ownerCreateOrder("auth0|exact_owner_123",{confirmed:true,idempotencyKey:"0".repeat(36)}),/owner_purchases_disabled/);
  await assert.rejects(dispatchOwnerOrder("low_fake_order"),/owner_purchases_disabled/);
 }finally{restore()}
});
test("one durable supplier add at most; ambiguous rejection is not retried",async()=>{
 configured();process.env.VERCEL_ENV="production";process.env.LITIX_OWNER_WHOLESALE_PURCHASES="true";
 let state="QUEUED",adds=0,cardCharges=0;
 const id="low_11111111-1111-4111-8111-111111111111";
 const row={id,owner_sub:"auth0|exact_owner_123",attempt_id:"attempt-1",provider:"boostero",supplier_service_id:"5461",destination:"https://www.instagram.com/test/",
  quantity:1000,supplier_cost_cents:300,total_charge_cents:300,payment_method:"supplier_balance",payment_state:"not_required"};
 const db={query:async(sql,params=[])=>{
  if(sql.startsWith("update public.litix_owner_wholesale_orders set state='DISPATCHING'")){
   if(state!=="QUEUED")return [];state="DISPATCHING";return [{...row}];
  }
  if(sql.startsWith("insert into public.litix_owner_wholesale_attempts"))return [];
  if(sql.startsWith("update public.litix_owner_wholesale_orders set state='SUBMITTED'")){state="SUBMITTED";return [{id}]}
  if(sql.startsWith("update public.litix_owner_wholesale_orders set state=$2")){state=params[1];return []}
  return [];
 }};
 const quoteProvider=async()=>({wholesaleCents:300,totalCents:300});
 const operation=async(p,action)=>{
  if(action==="balance")return {balance:"10.00"};
  if(action==="add"){adds++;throw Error("supplier_outcome_unknown")}
  cardCharges++;throw Error("wrong operation");
 };
 try{
  const a=await dispatchOwnerOrder(id,{db,quoteProvider,operation});
  assert.equal(a.state,"UNKNOWN_OUTCOME");
  const b=await dispatchOwnerOrder(id,{db,quoteProvider,operation});
  assert.equal(b.submitted,false);assert.equal(adds,1);assert.equal(cardCharges,0);
 }finally{restore()}
});

test("repeat owner PayKings submission cannot cause a second card charge or supplier purchase",async()=>{
 configured();
 const originalFetch=globalThis.fetch;
 const otherKeys=["NMI_SECURITY_KEY","NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY","LITIX_OWNER_PAYKINGS_FEE_BPS","LITIX_OWNER_PAYKINGS_FEE_FIXED_CENTS"];
 const existing=Object.fromEntries(otherKeys.map(x=>[x,process.env[x]]));
 Object.assign(process.env,{VERCEL_ENV:"production",LITIX_OWNER_WHOLESALE_PURCHASES:"true",
  LITIX_OWNER_PAYKINGS_ENABLED:"true",LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED:"true",NMI_SECURITY_KEY:"fake-key-not-used-live",
  NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY:"fake-collectjs-public",
  LITIX_OWNER_PAYKINGS_FEE_BPS:"290",LITIX_OWNER_PAYKINGS_FEE_FIXED_CENTS:"30"});
 let gatewayCalls=0,supplierCalls=0,insertCount=0,state="QUEUED";
 globalThis.fetch=async url=>{
  if(!String(url).includes("paykings.transactiongateway.com"))throw Error("Unexpected real network");
  gatewayCalls++;return new Response("response=1&transactionid=123456789",{status:200});
 };
 const orderId="low_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const db={query:async(sql,args=[])=>{
  if(sql.startsWith("insert into public.litix_owner_wholesale_orders")){
   insertCount++;return insertCount===1?[{id:orderId}]:[];
  }
  if(sql.startsWith("update public.litix_owner_wholesale_orders set payment_transaction_id="))return [{id:orderId}];
  if(sql.startsWith("update public.litix_owner_wholesale_orders set state='DISPATCHING'")){
   if(state!=="QUEUED")return [];state="DISPATCHING";
   return [{id:orderId,attempt_id:"unique-attempt",provider:"smmglob",supplier_service_id:"123",
    destination:"https://www.instagram.com/test/",quantity:1000,supplier_cost_cents:1000,
    total_charge_cents:1059,payment_method:"paykings",payment_state:"paid"}];
  }
  if(sql.startsWith("insert into public.litix_owner_wholesale_attempts"))return [];
  if(sql.startsWith("update public.litix_owner_wholesale_orders set state='SUBMITTED'")){
   state="SUBMITTED";return [{id:orderId}];
  }
  return [];
 }};
 const quote={provider:"smmglob",serviceId:"123",quantity:1000,
  service:{id:"123",name:"Instagram Followers",refillDays:30,refillEligible:false,refillMethod:"manual advertised"},
  destination:"https://www.instagram.com/test/",wholesalePer1000:10,wholesaleCents:1000,
  feeCents:59,totalCents:1059,paymentMethod:"paykings"};
 const getQuote=async()=>quote;
 const operation=async (provider,action)=>{
  if(action==="balance")return {balance:"40.00"};
  if(action==="add"){supplierCalls++;return {order:554433}}
  throw Error("Unexpected supplier operation");
 };
 const body={provider:"smmglob",serviceId:"123",quantity:1000,profile:"@test",paymentMethod:"paykings",
  expectedWholesaleCents:1000,expectedTotalCents:1059,paymentToken:"fake-tokenized-abc",
  idempotencyKey:"baaaaaaa-1111-4111-8111-111111111111",confirmed:true};
 try{
  const first=await ownerCreateOrder("auth0|exact_owner_123",body,{db,getQuote,operation});
  assert.equal(first.payment,"approved_pending_settlement");assert.equal(first.submitted,false);
  assert.equal(supplierCalls,0);assert.equal(gatewayCalls,1);
  await assert.rejects(ownerCreateOrder("auth0|exact_owner_123",body,{db,getQuote,operation}),/duplicate_purchase_blocked/);
  assert.equal(supplierCalls,0);assert.equal(gatewayCalls,1);
 }finally{
  globalThis.fetch=originalFetch;Object.entries(existing).forEach(([k,v])=>v==null?delete process.env[k]:process.env[k]=v);
  restore();
 }
});

test("private owner API denies unauthenticated requests, role headers and wholesale API scraping before provider calls",async()=>{
 const {GET,POST}=await import("../app/api/owner/wholesale/route.js");
 const url="https://litix.net/api/owner/wholesale?view=catalog";
 for(const headers of [{},{authorization:"Bearer fake-role-token","x-owner-role":"OWNER"},{cookie:"__Host-litix-wholesale-session=forged"},{email:"owner@example.com"}]){
  const res=await GET(new Request(url,{headers}));
  assert.equal(res.status,401);
  const body=await res.text();
  assert.ok(!body.includes("wholesalePer1000")&&!body.includes("pricePer1000")&&!body.includes("SMMGLOB_API_KEY"));
 }
 const post=await POST(new Request("https://litix.net/api/owner/wholesale",{
  method:"POST",headers:{"origin":"https://litix.net","content-type":"application/json","x-owner-role":"OWNER"},
  body:JSON.stringify({action:"purchase",confirmed:true,quantity:1000,provider:"boostero"})
 }));
 assert.equal(post.status,401);
});
