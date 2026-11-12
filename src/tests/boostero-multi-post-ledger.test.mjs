import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {stageBoosteroPostChildren,releasePaidBoosteroPosts,dispatchBoosteroPost} from "../lib/boosteroMultiPostFulfillment.mjs";
const orderId="ltx2_"+randomUUID();
const checkout=readFileSync(new URL("../lib/boosteroOrderHandler.mjs",import.meta.url),"utf8");
const privateTracking=readFileSync(new URL("../app/api/internal/boostero/track/route.js",import.meta.url),"utf8");

test("Pre-charge staging persists all three distinct children or refuses sale",async()=>{
 const calls=[];
 const sql={query:async(text,params)=>{calls.push({text,params});return [{ordinal:1},{ordinal:2},{ordinal:3}]}};
 const posts=[1,2,3].map(n=>({link:"https://www.instagram.com/p/ABCde"+n+"2345/",quantity:1000,amountCents:120}));
 assert.equal(await stageBoosteroPostChildren(orderId,"4751",posts,{sql}),true);
 assert.match(calls[0].text,/PENDING_PAYMENT/);
 assert.match(calls[0].text,/on conflict do nothing/);
 assert.equal(JSON.parse(calls[0].params[2]).length,3);
 await assert.rejects(stageBoosteroPostChildren(orderId,"invalid",posts,{sql}),/invalid_post_ledger_input/);
});
test("Children may enter supplier queue only after durable paid status and transaction ID",async()=>{
 let query="";
 const sql={query:async(q)=>{query=q;return [{ordinal:1},{ordinal:2},{ordinal:3}]}};
 assert.equal(await releasePaidBoosteroPosts(orderId,{sql}),3);
 assert.match(query,/o.payment_state='paid'/);
 assert.match(query,/o.payment_transaction_id is not null/);
 assert.match(query,/state='PENDING_PAYMENT'/);
});
test("Single claimed child makes exactly one mock supplier add and no second submission",async()=>{
 const before={};
 for(const key of ["VERCEL_ENV","LITIX_BOOSTERO_ENABLED","BOOSTERO_API_KEY","BOOSTERO_API_URL","LITIX_BOOSTERO_DATABASE_URL"])before[key]=process.env[key];
 Object.assign(process.env,{VERCEL_ENV:"production",LITIX_BOOSTERO_ENABLED:"true",BOOSTERO_API_KEY:"unit-test-placeholder",
 BOOSTERO_API_URL:"https://boostero.com/api/v2",LITIX_BOOSTERO_DATABASE_URL:"postgresql://unit-test.invalid/example"});
 try{
  let claimed=false,adds=0;
  const sql={query:async(q)=>{
   if(q.includes("set state='DISPATCHING'")){
    if(claimed)return []; claimed=true; return [{supplier_service_id:"4751",destination:"https://www.instagram.com/p/ABCDE123456/",quantity:1000,retail_cents:1200}];
   }
   if(q.includes("set state='SUBMITTED'"))return [{ordinal:1}];
   return [];
  }};
  const operation=async (action,params)=>{
   if(action==="balance")return {balance:"100"};
   if(action==="add"){adds++;assert.equal(params.link,"https://www.instagram.com/p/ABCDE123456/");return {order:"123456789"};}
   throw Error("unexpected external operation");
  };
  const quote=async()=>({quote:{serviceId:"4751"},service:{service:"4751",name:"Instagram Likes",category:"Instagram",type:"Default",min:10,max:1000000,rate:"6.99"}});
  const first=await dispatchBoosteroPost(orderId,1,{sql,operation,quote});
  assert.equal(first.submitted,true);
  const second=await dispatchBoosteroPost(orderId,1,{sql,operation,quote});
  assert.equal(second.submitted,false);
  assert.equal(adds,1);
 }finally{for(const [k,v] of Object.entries(before))v===undefined?delete process.env[k]:process.env[k]=v}
});
test("Production auto-dispatch remains gated, paid once, and offers private child tracking",()=>{
 assert.match(checkout,/LITIX_MULTIPOST_AUTO_FULFILL_ENABLED==="true"/);
 assert.match(checkout,/stageBoosteroPostChildren\(orderId,id,verifiedPosts,\{sql\}\)/);
 assert.match(checkout,/releasePaidBoosteroPosts\(orderId,\{sql\}\)/);
 assert.match(checkout,/dispatchBoosteroMultiPosts\(orderId,\{sql\}\)/);
 assert.ok(checkout.indexOf("stageBoosteroPostChildren")<checkout.indexOf("paykings.transactiongateway.com"));
 assert.match(privateTracking,/o.tracking_token_hash=\$2/);
 assert.match(privateTracking,/litix_boostero_multi_posts/);
 assert.doesNotMatch(privateTracking,/supplier_order_id:\s*p\.supplier_order_id/);
});
