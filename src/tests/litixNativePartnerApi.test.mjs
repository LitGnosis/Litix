import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {nativePartnerPublicCatalog,resolveNativePartner,executeNativePartnerAction} from "../lib/litixNativePartnerApi.mjs";

const key="A".repeat(64),key2="B".repeat(64);
const hash=s=>createHash("sha256").update(s).digest("hex");
const cfg={partners:[{id:"agency-one",keyHash:hash(key),maxDaily:2},{id:"agency-two",keyHash:hash(key2),maxDaily:1}]};
const env={LITIX_NATIVE_PARTNER_ORDERS_ENABLED:"true",LITIX_NATIVE_PARTNER_API_CONFIG:JSON.stringify(cfg)};
const brief={business:"Original Creator Studio",audience:"local creators",offer:"a custom marketing calendar",action:"Book a consultation",platform:"Instagram"};
const add=(requestId="native-demo-00001",newBrief=brief)=>({action:"add",requestId,serviceId:"litix-native-caption-kit",brief:newBrief});
function fakeSql(){
 const rows=[];
 return {rows,async query(sql,args){
  if(sql.startsWith("select id,service_id,request_hash")&&sql.includes("request_id=$2"))
   return rows.filter(x=>x.partner_id===args[0]&&x.request_id===args[1]).slice(0,1);
  if(sql.startsWith("select id,service_id,request_hash")&&sql.includes("id=$2::uuid"))
   return rows.filter(x=>x.partner_id===args[0]&&x.id===args[1]).slice(0,1);
  if(sql.startsWith("select count(*)::integer"))
   return [{count:rows.filter(x=>x.partner_id===args[0]).length}];
  if(sql.startsWith("insert into public.litix_native_partner_orders")){
   const [id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content]=args;
   if(rows.some(x=>x.partner_id===partner_id&&x.request_id===request_id))return [];
   const row={id,partner_id,request_id,service_id,request_hash,filename,mime_type,sha256,content,status:"COMPLETED",created_at:"2026-11-04T00:00:00Z"};
   rows.push(row);return [row];
  }
  throw Error("Unexpected query family");
 }};
}
test("public catalog reports genuine trial-only original digital services",()=>{
 const c=nativePartnerPublicCatalog();
 assert.equal(c.paidCheckoutEnabled,false);
 assert.equal(c.artificialEngagementAvailable,false);
 assert.ok(c.services.every(x=>x.trialOnly&&x.trialPriceCents===0&&x.activeForPaidOrders===false));
 assert.equal(c.services.length,2);
});
test("API keys are verified against hashes and reject malformed config",()=>{
 assert.equal(resolveNativePartner(key,env.LITIX_NATIVE_PARTNER_API_CONFIG).id,"agency-one");
 assert.equal(resolveNativePartner(key2,env.LITIX_NATIVE_PARTNER_API_CONFIG).id,"agency-two");
 assert.equal(resolveNativePartner("C".repeat(64),env.LITIX_NATIVE_PARTNER_API_CONFIG),null);
 assert.equal(resolveNativePartner("secret","{}"),null);
 assert.equal(resolveNativePartner(key,"not-json"),null);
});
test("POST remains disabled unless explicitly enabled server-side",async()=>{
 const result=await executeNativePartnerAction({payload:add(),key,env:{...env,LITIX_NATIVE_PARTNER_ORDERS_ENABLED:"false"},sql:fakeSql()});
 assert.equal(result.status,503);assert.equal(result.body.charged,false);
});
test("original content is self-fulfilled atomically and safe to replay",async()=>{
 const sql=fakeSql();
 const first=await executeNativePartnerAction({payload:add(),key,env,sql});
 const second=await executeNativePartnerAction({payload:add(),key,env,sql});
 assert.equal(first.status,201);assert.equal(second.status,200);
 assert.equal(first.body.status,"COMPLETED");assert.equal(first.body.charged,false);
 assert.equal(first.body.orderId,second.body.orderId);
 assert.equal(first.body.sha256,second.body.sha256);
 assert.equal(second.body.replayed,true);
 assert.equal(sql.rows.length,1);
 assert.match(first.body.content,/Original Creator Studio/);
});
test("reusing an order key for different assets rejects collision",async()=>{
 const sql=fakeSql(); await executeNativePartnerAction({payload:add(),key,env,sql});
 const next=await executeNativePartnerAction({payload:add("native-demo-00001",{...brief,offer:"a totally different newsletter"}),key,env,sql});
 assert.equal(next.status,409);assert.equal(sql.rows.length,1);
});
test("status is tenant-scoped; content requires explicit request",async()=>{
 const sql=fakeSql(),order=await executeNativePartnerAction({payload:add(),key,env,sql});
 const status=await executeNativePartnerAction({payload:{action:"status",orderId:order.body.orderId},key,env,sql});
 assert.equal(status.status,200);assert.equal(status.body.content,undefined);
 const withAsset=await executeNativePartnerAction({payload:{action:"status",orderId:order.body.orderId,includeAsset:true},key,env,sql});
 assert.match(withAsset.body.content,/Original Creator Studio/);
 const other=await executeNativePartnerAction({payload:{action:"status",orderId:order.body.orderId},key:key2,env,sql});
 assert.equal(other.status,404);assert.equal(sql.rows.length,1);
});
test("unauthorized and fake engagement requests never record an order",async()=>{
 const sql=fakeSql();
 const noKey=await executeNativePartnerAction({payload:add(),key:"bad",env,sql});
 const fake=await executeNativePartnerAction({payload:{...add(),serviceId:"litix-native-followers"},key,env,sql});
 assert.equal(noKey.status,401);assert.equal(fake.status,422);assert.equal(sql.rows.length,0);
});
test("config-based trial daily limit blocks additional unique orders",async()=>{
 const sql=fakeSql();
 const a=await executeNativePartnerAction({payload:add("request-0001"),key:key2,env,sql});
 const b=await executeNativePartnerAction({payload:add("request-0002"),key:key2,env,sql});
 assert.equal(a.status,201);assert.equal(b.status,429);assert.equal(sql.rows.length,1);
 const repeat=await executeNativePartnerAction({payload:add("request-0001"),key:key2,env,sql});
 assert.equal(repeat.status,200);
});
test("database errors fail closed without claiming delivery",async()=>{
 const broken={query:async()=>{throw Error("Database unavailable");}};
 const x=await executeNativePartnerAction({payload:add(),key,env,sql:broken});
 assert.equal(x.status,503);assert.equal(x.body.supplierOrderCreated,false);
});
