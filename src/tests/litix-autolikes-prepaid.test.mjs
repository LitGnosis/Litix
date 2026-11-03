import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PREPAID_PRICE_TIERS,quotePrepaidAutoLikes,prepaidNativeService,
 prepaidNativeSupplierParams,prepaidPeriodEnd} from "../lib/litixPrepaidAutoLikes.mjs";
import {dispatchPrepaidAutoLikes} from "../lib/litixPrepaidAutoLikesFulfillment.mjs";
const srv={service:2297,name:"Instagram Auto Likes",category:"Instagram Services",
 type:"Subscriptions",rate:"1.00",min:"10",max:"100000"};
const tik={...srv,service:9999,name:"TikTok Auto Likes",category:"TikTok"};
test("seven published price points with independently defined Litix counts",()=>{
 assert.deepEqual(PREPAID_PRICE_TIERS.map(t=>t.tenPostsCents),[400,700,1000,1500,2400,4000,7000]);
 assert.deepEqual(PREPAID_PRICE_TIERS.map(t=>t.likesPerPost),[50,100,150,250,400,650,1150]);
 assert.equal(quotePrepaidAutoLikes({services:[srv],platform:"instagram",profile:"@litixsocial",tierId:"lite",posts:10}).amountCents,400);
 assert.equal(quotePrepaidAutoLikes({services:[srv],platform:"instagram",profile:"@litixsocial",tierId:"max",posts:10}).amountCents,7000);
 assert.equal(quotePrepaidAutoLikes({services:[srv],platform:"instagram",profile:"@litixsocial",tierId:"lite",posts:1}).amountCents,100);
});
test("enforce hard 10-post limit, valid public profiles and supplier eligibility",()=>{
 assert.ok(prepaidNativeService([srv,tik],"instagram",50));
 assert.equal(prepaidNativeService([srv,tik],"tiktok",50).service,9999);
 assert.equal(prepaidNativeService([{...srv,min:100}],"instagram",50),null);
 for(const posts of [0,-1,11,1.5,1000])
  assert.throws(()=>quotePrepaidAutoLikes({services:[srv],platform:"instagram",profile:"@litixsocial",tierId:"lite",posts}));
 assert.throws(()=>quotePrepaidAutoLikes({services:[srv],platform:"instagram",profile:"https://evil.example/",tierId:"lite",posts:10}));
 assert.throws(()=>quotePrepaidAutoLikes({services:[srv],platform:"instagram",profile:"@litixsocial",tierId:"unknown",posts:10}));
});
test("native watcher only tracks future posts; expires in thirty days",()=>{
 const now=new Date("2026-11-01T12:00:00Z");
 const q=quotePrepaidAutoLikes({services:[srv],platform:"instagram",profile:"@litixsocial",tierId:"lite",posts:10});
 assert.equal(prepaidPeriodEnd(now),"2026-12-01T12:00:00.000Z");
 assert.deepEqual(prepaidNativeSupplierParams(q,now),{
  service:"2297",username:"litixsocial",min:"50",max:"50",
  posts:"10",old_posts:"0",delay:"0",expiry:"01/12/2026"
 });
});
test("claimed supplier operation is called once, never twice on duplicate cron",async()=>{
 const saved=Object.fromEntries(["VERCEL_ENV","LITIX_AUTOLIKES_PREPAID_ENABLED","LITIX_BOOSTERO_ENABLED","BOOSTERO_API_KEY","BOOSTERO_API_URL","LITIX_BOOSTERO_DATABASE_URL","NMI_SECURITY_KEY"].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{VERCEL_ENV:"production",LITIX_AUTOLIKES_PREPAID_ENABLED:"true",
 LITIX_BOOSTERO_ENABLED:"true",BOOSTERO_API_KEY:"fake",BOOSTERO_API_URL:"https://boostero.com/api/v2",
 LITIX_BOOSTERO_DATABASE_URL:"postgres://no-server.invalid/fake",NMI_SECURITY_KEY:"not-a-real-nmi-security-key"});
 try{
  const expiry=new Date(Date.now()+30*86400000).toISOString();
  const item={id:"alp_dummy",service_id:"2297",platform:"instagram",
   target_profile_url:"https://www.instagram.com/litixsocial/",likes_per_post:50,
   posts_limit:10,tier_id:"lite",amount_cents:400,wholesale_reserved_cents:50,period_end:expiry};
  let claimed=false,submissions=0;
  const sql={query:async(query)=>{
   if(query.startsWith("select id,service_id"))return [item];
   if(query.startsWith("select coalesce(sum"))return [{cents:"0"}];
   if(query.startsWith("update public.litix_autolikes_prepaid_orders set fulfillment_state='CLAIMED'")){
    if(claimed)return [];claimed=true;return [{id:item.id}];
   }
   if(query.startsWith("update public.litix_autolikes_prepaid_orders set fulfillment_state='SUBMITTED'"))return [{id:item.id}];
   return [];
  }};
  const supplier=async(action,params)=>{
   if(action==="services")return [srv];
   if(action==="balance")return {balance:"5.00"};
   if(action==="prepaid_subscription"){submissions++;assert.equal(params.posts,"10");assert.equal(params.old_posts,"0");return {order:"98765"}}
   throw Error("Unexpected supplier action");
  };
  const a=await dispatchPrepaidAutoLikes({sql,supplier,limit:1});
  const b=await dispatchPrepaidAutoLikes({sql,supplier,limit:1});
  assert.equal(a.submitted,1);assert.equal(b.submitted,0);assert.equal(submissions,1);
 }finally{
  for(const [k,v] of Object.entries(saved))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
test("customer APIs and pages do not disclose supplier identity, wholesale costs or supplier order ids",()=>{
 const files=[
 "../app/api/autolikes/prepaid/catalog/route.js",
 "../app/api/autolikes/prepaid/quote/route.js",
 "../app/api/autolikes/prepaid/manage/route.js",
 "../app/autolikes/page.jsx",
 "../app/autolikes/prepaid/manage/page.jsx"
 ];
 for(const path of files){
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.doesNotMatch(source,/supplierOrderId|supplierCostCents|wholesaleCents|providerRate|SMMGLOB/);
  if(path.endsWith("page.jsx"))assert.doesNotMatch(source,/Boostero|SMMGLOB|wholesale/i);
 }
 const checkout=readFileSync(new URL("../app/api/autolikes/prepaid/checkout/route.js",import.meta.url),"utf8");
 assert.match(checkout,/type:"sale"/);assert.doesNotMatch(checkout,/recurring:"add_subscription"|monthly_payment|autoRenew:true/);
 assert.match(checkout,/idempotency_key/);
 assert.match(checkout,/payment_status='PAID'/);
});
