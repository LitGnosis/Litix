import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ZORA_API_URL,zoraProviderConfigured,eligibleZoraSubscription,selectZoraSubscription,quoteZoraPrepaid,zoraSubscriptionPayload,zoraSupplier} from "../lib/litixZoraAutoLikesSupplier.mjs";
import {dispatchZoraAutoLikes,syncZoraAutoLikes} from "../lib/litixZoraAutoLikesFulfillment.mjs";
import {autolikesNewSalesEnabled} from "../lib/litixAutoLikesSalesGate.mjs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const env={VERCEL_ENV:"production",LITIX_AUTOLIKES_SUPPLIER:"zorasmm",LITIX_ZORA_AUTOLIKES_VERIFIED:"true",ZORASMM_API_KEY:"private-test-api-key-123456",LITIX_ZORA_INSTAGRAM_SERVICE_ID:"1159",LITIX_ZORA_TIKTOK_SERVICE_ID:"1161"};
const service={service:1159,name:"Instagram Auto Likes — New Posts",category:"Instagram Likes",type:"Subscriptions",min:"20",max:"100000",rate:"0.30"};
const profile="https://www.instagram.com/litgnosisllc/";
test("Zora supplier adapter fails closed before account verification",()=>{
 assert.equal(zoraProviderConfigured({}),false);
 assert.equal(zoraProviderConfigured({...env,LITIX_ZORA_AUTOLIKES_VERIFIED:"false"}),false);
 assert.equal(zoraProviderConfigured({...env,LITIX_AUTOLIKES_SUPPLIER:"boostero"}),false);
 assert.equal(zoraProviderConfigured(env),true);
 assert.equal(autolikesNewSalesEnabled(),false);
 assert.equal(ZORA_API_URL,"https://zorasmm.com/api/v2");
});
test("only an exact, catalog-verified Subscriptions-type Likes service is accepted",()=>{
 assert.equal(eligibleZoraSubscription(service,"instagram"),true);
 assert.equal(eligibleZoraSubscription({...service,type:"Default"},"instagram"),false);
 assert.equal(eligibleZoraSubscription({...service,name:"Instagram Followers"},"instagram"),false);
 assert.equal(eligibleZoraSubscription(service,"tiktok"),false);
 assert.equal(selectZoraSubscription([service],"instagram",100,env).service,1159);
 assert.throws(()=>selectZoraSubscription([{...service,service:1162}],"instagram",100,env));
 assert.throws(()=>selectZoraSubscription([service],"instagram",10,env));
 assert.throws(()=>selectZoraSubscription([service],"instagram",100,{...env,LITIX_ZORA_INSTAGRAM_SERVICE_ID:""}));
});
test("one-time quote retains posted quantity, expiry and no old posts",()=>{
 const quote=quoteZoraPrepaid({services:[service],platform:"instagram",profile,tierId:"start",posts:10},env);
 assert.equal(quote.supplierServiceId,"1159");
 assert.equal(quote.likesPerPost,100);
 assert.equal(quote.posts,10);
 assert.ok(quote.amountCents>=100);
 assert.ok(quote.amountCents>=Math.ceil(quote.wholesaleCents*1.6));
 const params=zoraSubscriptionPayload(quote,new Date("2026-11-04T16:00:00.000Z"));
 assert.deepEqual({service:params.service,username:params.username,min:params.min,max:params.max,posts:params.posts,old_posts:params.old_posts,delay:params.delay,expiry:params.expiry},
 {service:"1159",username:"litgnosisllc",min:"100",max:"100",posts:"10",old_posts:"0",delay:"0",expiry:"04/12/2026"});
});
test("credentials stay server-side, no subscription add without claimed PAID path",async()=>{
 const entries=[];
 const fakeFetch=async (url,opts)=>{
  entries.push({url,params:new URLSearchParams(opts.body)});
  return {ok:true,json:async()=>({order:98765})};
 };
 const quote=quoteZoraPrepaid({services:[service],platform:"instagram",profile,tierId:"start",posts:10},env);
 const params=zoraSubscriptionPayload(quote,new Date("2026-11-04T16:00:00.000Z"));
 await assert.rejects(zoraSupplier("subscription",params,{env,fetcher:fakeFetch,platform:"instagram"}),/not_authorized/);
 assert.equal(entries.length,0);
 const result=await zoraSupplier("subscription",params,{env,claimed:true,fetcher:fakeFetch,platform:"instagram"});
 assert.equal(result.order,98765);
 assert.equal(entries.length,1);
 assert.equal(entries[0].url,ZORA_API_URL);
 assert.equal(entries[0].params.get("action"),"add");
 assert.equal(entries[0].params.get("old_posts"),"0");
 assert.equal(entries[0].params.get("username"),"litgnosisllc");
 assert.equal(entries[0].params.get("posts"),"10");
 assert.equal(entries[0].params.get("key"),env.ZORASMM_API_KEY);
 await assert.rejects(zoraSupplier("subscription",params,{env:{...env,LITIX_ZORA_AUTOLIKES_VERIFIED:"false"},claimed:true,fetcher:fakeFetch,platform:"instagram"}),/not_authorized/);
 assert.equal(entries.length,1);
});
test("supplier network ambiguity is never automatically retried",async()=>{
 let attempts=0;
 const quote=quoteZoraPrepaid({services:[service],platform:"instagram",profile,tierId:"start",posts:10},env);
 const params=zoraSubscriptionPayload(quote,new Date("2026-11-04T16:00:00.000Z"));
 await assert.rejects(zoraSupplier("subscription",params,{env,claimed:true,platform:"instagram",fetcher:async()=>{attempts++;throw Error("timeout")}}),/outcome_unknown/);
 assert.equal(attempts,1);
});
test("paid Zora ledger is claimed once and supplier status syncs without charging",async()=>{
 const order={litix_order_id:"alp_ed028bad-aefe-4fd5-a89a-b201ea0a11f7",platform:"instagram",service_id:"1159",target_profile_url:profile,tier_id:"start",posts_limit:10,likes_per_post:100,amount_cents:700,wholesale_reserved_cents:100,paid_at:"2026-11-04T16:00:00.000Z",period_end:"2026-12-04T16:00:00.000Z"};
 const commands=[];
 const sql={query:async (statement,values=[])=>{
  commands.push(statement);
  if(statement.startsWith("select z.litix_order_id"))return [order];
  if(statement.startsWith("select coalesce"))return [{cents:"0"}];
  if(statement.includes("state='CLAIMED'"))return [{litix_order_id:order.litix_order_id}];
  if(statement.includes("state='SUBMITTED',supplier_order_id"))return [{litix_order_id:order.litix_order_id}];
  if(statement.startsWith("select litix_order_id,supplier_order_id"))return [{litix_order_id:order.litix_order_id,supplier_order_id:"98765"}];
  return [];
 }};
 const operations=[];
 const supplier=async(action,params,opts)=>{
  operations.push(action);
  if(action==="services")return [service];
  if(action==="balance")return {balance:"100"};
  if(action==="subscription")return {order:98765};
  if(action==="status")return {status:"In progress"};
  throw Error("unknown");
 };
 const dispatch=await dispatchZoraAutoLikes({sql,supplier,env,limit:1});
 assert.deepEqual({checked:dispatch.checked,submitted:dispatch.submitted,unknown:dispatch.unknown},{checked:1,submitted:1,unknown:0});
 assert.equal(operations.filter(x=>x==="subscription").length,1);
 assert.ok(commands.some(x=>x.includes("payment_status='PAID'")));
 assert.ok(commands.some(x=>x.includes("state='CLAIMED'")));
 const tracking=await syncZoraAutoLikes({sql,supplier,env,limit:1});
 assert.equal(tracking.updated,1);
 assert.equal(operations.includes("status"),true);
 assert.ok(operations.every(x=>x!=="pay"&&x!=="charge"));
});
test("existing Boostero ledger, public paused checkout and private tracking remain unchanged",()=>{
 assert.match(read("app/api/autolikes/prepaid/checkout/route.js"),/if\(!autolikesNewSalesEnabled\(\)\)/);
 assert.match(read("app/autolikes/page.jsx"),/New Orders Paused/);
 assert.match(read("app/autolikes/prepaid/manage/page.jsx"),/api\/autolikes\/prepaid\/manage/);
 assert.match(read("lib/litixZoraAutoLikesFulfillment.mjs"),/litix_zora_autolikes_subscriptions/);
 assert.doesNotMatch(read("lib/litixPrepaidAutoLikesFulfillment.mjs"),/zoraSupplier/);
 assert.match(read("app/api/autolikes/zora/cron/route.js"),/CRON_SECRET/);
 const cfg=JSON.parse(read("vercel.json"));
 assert.equal(cfg.crons.some(x=>x.path==="/api/autolikes/zora/cron"),true);
});
