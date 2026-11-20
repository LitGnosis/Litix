import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {ownerConfig,signOwner,verifyOwner,readOwnerSession,assertOwnerMutation} from "../lib/ownerPortalAuth.mjs";
import {parseService,costCents,normalizeOwnerTarget,parseWallet,supplierCall} from "../lib/ownerSupplierGateway.mjs";

const prior={};
function envForTest(){
 for(const k of ["LITIX_OWNER_AUTH0_DOMAIN","LITIX_OWNER_AUTH0_SUB","LITIX_OWNER_AUTH0_CLIENT_ID",
  "LITIX_OWNER_AUTH0_CLIENT_SECRET","LITIX_OWNER_SESSION_SECRET","LITIX_OWNER_PORTAL_ORIGIN",
  "LITIX_OWNER_PURCHASES_ENABLED","LITIX_OWNER_BOOSTERO_ENABLED","VERCEL_ENV"]){prior[k]=process.env[k];}
 Object.assign(process.env,{LITIX_OWNER_AUTH0_DOMAIN:"tenant.example.auth0.com",
  LITIX_OWNER_AUTH0_SUB:"auth0|owner12345",LITIX_OWNER_AUTH0_CLIENT_ID:"verified-client",
  LITIX_OWNER_AUTH0_CLIENT_SECRET:"private-client-secret-key-12345",
  LITIX_OWNER_SESSION_SECRET:"x".repeat(64),LITIX_OWNER_PORTAL_ORIGIN:"https://www.litix.net",
  LITIX_OWNER_PURCHASES_ENABLED:"false",LITIX_OWNER_BOOSTERO_ENABLED:"false",VERCEL_ENV:"production"});
}
function clean(){for(const [k,v] of Object.entries(prior))if(v===undefined)delete process.env[k];else process.env[k]=v}
test("owner requires configured Auth0 subject and ignores customer cookie",()=>{
 envForTest();
 try{
  const c=ownerConfig();assert.equal(c.sub,"auth0|owner12345");
  const now=Math.floor(Date.now()/1000),csrf="a".repeat(64);
  const good=signOwner("session",{sub:c.sub,iss:c.issuer,aud:c.clientId,iat:now,exp:now+1000,csrf});
  const headers=new Headers({cookie:"__Host-litix-owner-portal="+good});
  assert.equal(readOwnerSession(headers)?.sub,c.sub);
  const customer=signOwner("session",{sub:"auth0|some-customer",iss:c.issuer,aud:c.clientId,iat:now,exp:now+1000,csrf});
  assert.equal(readOwnerSession(new Headers({cookie:"__Host-litix-owner-portal="+customer})),null);
  assert.equal(verifyOwner("session",good+"tamper"),null);
  assert.throws(()=>assertOwnerMutation({url:"https://www.litix.net/api/owner/portal",headers:new Headers({
   cookie:"__Host-litix-owner-portal="+good,origin:"https://other.example",
   "x-litix-owner-csrf":csrf})}),/owner_csrf_rejected/);
 }finally{clean()}
});
test("unconfigured or unsupported wholesale source cannot submit real add",async()=>{
 envForTest();try{
  await assert.rejects(supplierCall("boostero","add",{service:"123",quantity:100,link:"https://instagram.com/a"},{approved:true}),/owner_supplier_not_connected/);
 }finally{clean()}
});
test("owner live catalog parser never applies retail markup",()=>{
 const x=parseService({service:123,name:"Instagram Followers High Quality 10K/Day",type:"Default",
  rate:"2.85",category:"Instagram Followers",min:"100",max:"20000",refill:true},"boostero");
 assert.equal(x.rateUSDPer1000,2.85);assert.equal(costCents(x,1000),285);
 assert.equal(costCents(x,100),29);
 assert.throws(()=>costCents(x,20001));
 assert.equal(x.refillAdvertised,true);
 assert.equal(x.deliveryVerified,false);
 assert.deepEqual(parseWallet({balance:"45.32",currency:"USD"}),{balanceCents:4532,currency:"USD"});
 assert.throws(()=>parseWallet({balance:"45.32",currency:"INR"}));
});
test("owner target normalization blocks dangerous and unrelated domains",()=>{
 const item={platform:"Instagram"};
 assert.match(normalizeOwnerTarget("@litixsocial",item),/^https:\/\/www\.instagram\.com/);
 for(const url of ["http://instagram.com/a","https://instagram.com.evil.com/a",
  "https://127.0.0.1/private","javascript:alert(1)","https://instagram.com/"])
   assert.throws(()=>normalizeOwnerTarget(url,item),url);
});
test("owner-only route and separate DB ledger preserve public site",async()=>{
 const code=await readFile(new URL("../app/api/owner/portal/route.js",import.meta.url),"utf8");
 const sql=await readFile(new URL("../db/migrations/20261120-owner-portal.sql",import.meta.url),"utf8");
 const ui=await readFile(new URL("../app/owner/page.jsx",import.meta.url),"utf8");
 assert.match(code,/assertOwnerMutation\(request\)/);
 assert.match(code,/body\.confirmed!==true/);
 assert.match(code,/LITIX_OWNER_PURCHASES_ENABLED/);
 assert.match(code,/doNotRetry:true/);
 assert.match(code,/owner_supplier_unknown_outcome/);
 assert.match(sql,/litix_owner_portal_one_pending_per_wallet/);
 assert.match(ui,/readOwnerSession\(await headers\(\)\)/);
});
