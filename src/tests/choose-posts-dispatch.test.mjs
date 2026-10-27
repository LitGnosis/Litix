import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const raw=readFileSync(new URL("../lib/choosePostsServer.mjs",import.meta.url),"utf8")
 .replace('import {neon} from "@neondatabase/serverless";','const neon=()=>globalThis.__chooseTestSql;')
 .replace('import {sendOwnerPurchaseNotification} from "./ownerNotifications.mjs";','const sendOwnerPurchaseNotification=async()=>true;')
 .replace('"./pricing.mjs"',JSON.stringify(new URL("../lib/pricing.mjs",import.meta.url).href))
 .replace('"./choosePosts.mjs"',JSON.stringify(new URL("../lib/choosePosts.mjs",import.meta.url).href));
const lib=await import("data:text/javascript,"+encodeURIComponent(raw));
const orderId="ltx2_11111111-1111-4111-8111-111111111111";
function harness(mode="reject",paid=true){
 const rows=[
  {id:"i1",post_url:"https://www.instagram.com/p/ABCDE12345/",quantity:1000,service_id:"33630",state:"QUEUED",attempt_count:0,supplier_order_id:null},
  {id:"i2",post_url:"https://www.instagram.com/p/ABCDE23456/",quantity:1000,service_id:"33630",state:"QUEUED",attempt_count:0,supplier_order_id:null}
 ];
 let supplierCalls=0,charges=0,emails=0;
 globalThis.__chooseTestSql={query:async(sql,params=[])=>{
  if(sql.startsWith("select i.id,i.post_url"))return paid?rows.filter(x=>x.state==="QUEUED").map(x=>({...x})):[];
  if(sql.startsWith("update public.litix_choose_posts_items set state='DISPATCHING'")){
   const found=rows.find(x=>x.id===params[0]&&x.state==="QUEUED");if(!found||!paid)return [];
   found.state="DISPATCHING";found.attempt_count++;return [{attempt_count:found.attempt_count}];
  }
  if(sql.startsWith("insert into public.litix_choose_posts_attempts"))return [];
  if(sql.startsWith("update public.litix_choose_posts_items set supplier_order_id")){
   const x=rows.find(z=>z.id===params[0]);x.state="SUBMITTED";x.supplier_order_id=params[1];return [];
  }
  if(sql.startsWith("update public.litix_choose_posts_items set state=$2")){
   const x=rows.find(z=>z.id===params[0]);x.state=params[1];return [];
  }
  if(sql.startsWith("select state from public.litix_choose_posts_items"))return rows.map(x=>({state:x.state}));
  if(sql.startsWith("select email,service_name,total_cents"))return [{email:"preview@example.com",service_name:"Instagram Likes",total_cents:1000}];
  return [];
 }};
 const old=globalThis.fetch;
 globalThis.fetch=async (url,options)=>{
  if(String(url).includes("api.resend.com")){emails++;return new Response("{}",{status:200})}
  if(String(url).includes("smmglob.com")){supplierCalls++;
   if(mode==="ambiguous"&&supplierCalls===2)throw Error("Supplier timed out");
   if(mode==="reject"&&supplierCalls===2)return Response.json({error:"Definite rejection"});
   return Response.json({order:"SUPPLIER_TEST_"+supplierCalls});
  }
  charges++;throw Error("Unexpected payment request");
 };
 const env={SMMGLOB_API_KEY:process.env.SMMGLOB_API_KEY,RESEND_API_KEY:process.env.RESEND_API_KEY,LITIX_CHOOSE_POSTS_DATABASE_URL:process.env.LITIX_CHOOSE_POSTS_DATABASE_URL};
 process.env.SMMGLOB_API_KEY="test-only";process.env.RESEND_API_KEY="test-only";process.env.LITIX_CHOOSE_POSTS_DATABASE_URL="postgresql://example.invalid/placeholder";
 return {rows,call:()=>lib.dispatchPaidPosts(orderId),get calls(){return supplierCalls},get charges(){return charges},get emails(){return emails},
  restore(){globalThis.fetch=old;Object.entries(env).forEach(([key,val])=>val==null?delete process.env[key]:process.env[key]=val);delete globalThis.__chooseTestSql}};
}
test("post-payment two SMMGLOB orders use independent supplier IDs; a definite rejected post is retryable without extra charge",async()=>{
 const h=harness("reject");
 try{
  const result=await h.call();
  assert.equal(result.status,"manual_review");
  assert.equal(h.rows[0].state,"SUBMITTED");assert.equal(h.rows[0].supplier_order_id,"SUPPLIER_TEST_1");
  assert.equal(h.rows[1].state,"RETRYABLE");assert.equal(h.rows[1].supplier_order_id,null);
  assert.equal(h.calls,2);assert.equal(h.charges,0);
  await h.call();assert.equal(h.calls,2,"no duplicate supplier submission on retry of entire workflow");
 }finally{h.restore()}
});
test("unknown supplier outcome is not retried automatically",async()=>{
 const h=harness("ambiguous");
 try{await h.call();assert.equal(h.rows[1].state,"UNKNOWN_OUTCOME");assert.equal(h.calls,2);
  await h.call();assert.equal(h.calls,2);assert.equal(h.charges,0)}
 finally{h.restore()}
});
test("unpaid multi-post order never dispatches supplier requests",async()=>{
 const h=harness("reject",false);
 try{await h.call();assert.equal(h.calls,0);assert.equal(h.charges,0)}finally{h.restore()}
});
