import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const raw=readFileSync(new URL("../lib/choosePostsServer.mjs",import.meta.url),"utf8")
 .replace('import {neon} from "@neondatabase/serverless";','const neon=()=>globalThis.__chooseTestSql;')
 .replace('import {sendOwnerPurchaseNotification} from "./ownerNotifications.mjs";','const sendOwnerPurchaseNotification=async()=>true;')
 .replace('"./pricing.mjs"',JSON.stringify(new URL("../lib/pricing.mjs",import.meta.url).href))
 .replace('"./choosePosts.mjs"',JSON.stringify(new URL("../lib/choosePosts.mjs",import.meta.url).href));
const lib=await import("data:text/javascript,"+encodeURIComponent(raw));

test("supplier adapter is hard-disabled for every new-order action even if legacy credentials are present",async()=>{
 let calls=0;
 const oldFetch=globalThis.fetch,oldKey=process.env.SMMGLOB_API_KEY;
 globalThis.fetch=async()=>{calls++;throw Error("UNAUTHORIZED_PROVIDER_NETWORK_ATTEMPT")};
 process.env.SMMGLOB_API_KEY="synthetic-only-do-not-use";
 try{
  for(const action of ["services","add","status","refill"]){
   await assert.rejects(lib.supplier(action,{service:"33442",quantity:"1000"}),/Boostero multi-post adapter not released/);
  }
  assert.equal(calls,0,"No SMMGLOB/other supplier calls");
 }finally{
  globalThis.fetch=oldFetch;
  if(oldKey===undefined)delete process.env.SMMGLOB_API_KEY;
  else process.env.SMMGLOB_API_KEY=oldKey;
 }
});
test("pending draft dispatch never touches DB, gateway, emails or any supplier",async()=>{
 let dbCalls=0,network=0;
 const old=globalThis.fetch;globalThis.__chooseTestSql={query:async()=>{dbCalls++;throw Error("MUST_NOT_TOUCH_DATABASE")}};
 globalThis.fetch=async()=>{network++;throw Error("MUST_NOT_CALL_PROVIDER")};
 try{
  const result=await lib.dispatchPaidPosts("ltx2_11111111-1111-4111-8111-111111111111");
  assert.deepEqual(result,{status:"blocked_not_released",items:[]});
  assert.equal(dbCalls,0);assert.equal(network,0);
 }finally{globalThis.fetch=old;delete globalThis.__chooseTestSql;}
});
test("draft checkout is preview-only with no possible live PayKings sale or retry",()=>{
 const checkout=readFileSync(new URL("../app/api/choose-posts/checkout/route.js",import.meta.url),"utf8");
 const retry=readFileSync(new URL("../app/api/choose-posts/retry/route.js",import.meta.url),"utf8");
 assert.match(checkout,/paymentReady:false/);
 assert.match(checkout,/if\(!previewDemo\(\)\)return output/);
 assert.match(checkout,/if\(x\?\.simulate!==true\)return output/);
 assert.match(retry,/return Response\.json\(\{error:"Boostero multi-post retry is not released/);
});
