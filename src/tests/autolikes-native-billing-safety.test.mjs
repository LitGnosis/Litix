import test from "node:test";
import assert from "node:assert/strict";
import {boosteroProduction} from "../lib/boosteroReadOnly.mjs";
import {nativeCycleEvidence,reconcileNativeAutoLikes,dispatchNativeAutoLikes} from "../lib/nativeAutoLikesFulfillment.mjs";
import {autoLikesRecurringCheckoutReady,nmiAutoLikesEnrollmentForm,nmiAutoLikesCancellationForm,nmiAutoLikesResult} from "../lib/nmiAutoLikesRecurring.mjs";

const keys=["VERCEL_ENV","LITIX_AUTOLIKES_CHECKOUT_ENABLED","LITIX_AUTOLIKES_DISPATCH_ENABLED",
 "LITIX_AUTOLIKES_CANCEL_ENABLED","LITIX_AUTOLIKES_NMI_RECONCILE_ENABLED",
 "LITIX_NMI_RECURRING_MERCHANT_APPROVED","NMI_SECURITY_KEY","LITIX_BOOSTERO_ENABLED",
 "BOOSTERO_API_KEY","BOOSTERO_API_URL","LITIX_BOOSTERO_DATABASE_URL"];
function environment(vars,run){
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,vars);
 return Promise.resolve().then(run).finally(()=>{
  for(const k of keys)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];
 });
}
const enabled={
 VERCEL_ENV:"production",LITIX_AUTOLIKES_CHECKOUT_ENABLED:"true",
 LITIX_AUTOLIKES_DISPATCH_ENABLED:"true",LITIX_AUTOLIKES_CANCEL_ENABLED:"true",
 LITIX_AUTOLIKES_NMI_RECONCILE_ENABLED:"true",LITIX_NMI_RECURRING_MERCHANT_APPROVED:"true",
 NMI_SECURITY_KEY:"fake-only-nmi-key-not-real",LITIX_BOOSTERO_ENABLED:"true",
 BOOSTERO_API_URL:"https://boostero.com/api/v2",BOOSTERO_API_KEY:"fake-only-boostero-key-not-real",
 LITIX_BOOSTERO_DATABASE_URL:"postgresql://fake.invalid/not_real"
};
test("recurring billing is refused until every permission is explicitly configured",async()=>{
 await environment({...enabled,LITIX_NMI_RECURRING_MERCHANT_APPROVED:"false"},()=>{
  assert.equal(autoLikesRecurringCheckoutReady(),false);
 });
 await environment({...enabled,LITIX_AUTOLIKES_CANCEL_ENABLED:"false"},()=>{
  assert.equal(autoLikesRecurringCheckoutReady(),false);
 });
 await environment({...enabled,LITIX_AUTOLIKES_NMI_RECONCILE_ENABLED:"false"},()=>{
  assert.equal(autoLikesRecurringCheckoutReady(),false);
 });
 await environment(enabled,()=>assert.equal(autoLikesRecurringCheckoutReady(),true));
});
test("NMI recurring billing only uses token, amount, month cap, and hard provider checks",()=>{
 const key="fake-only-nmi-security-key";
 const f=nmiAutoLikesEnrollmentForm({amountCents:6000,paymentToken:"tokenAB12-xyz_987",dayOfMonth:14,
  orderId:"al_"+"a".repeat(40)},key);
 assert.equal(f.get("recurring"),"add_subscription");
 assert.equal(f.get("plan_amount"),"60.00");
 assert.equal(f.get("month_frequency"),"1");
 assert.equal(f.has("ccnumber"),false);
 assert.throws(()=>nmiAutoLikesEnrollmentForm({amountCents:0,paymentToken:"tokenAB12-xyz_987",dayOfMonth:14,orderId:"al_"+"a".repeat(40)},key));
 assert.throws(()=>nmiAutoLikesEnrollmentForm({amountCents:6000,paymentToken:"4111111111111111",dayOfMonth:14,orderId:"al_"+"a".repeat(40)},key));
 assert.equal(nmiAutoLikesCancellationForm("1234567",key).get("recurring"),"delete_subscription");
 assert.equal(nmiAutoLikesResult("response=1&response_code=100&subscription_id=5678").subscriptionId,"5678");
 assert.equal(nmiAutoLikesResult("response=2&response_code=200").approved,false);
});
test("native supplier action is once-claimed and bounded, while ordinary add is unchanged",async()=>{
 await environment(enabled,async()=>{
  let requests=0;
  const fake=async(_url,o)=>{
   requests++;
   const posted=new URLSearchParams(o.body);
   assert.equal(posted.get("action"),"add");
   assert.equal(posted.get("username"),"litixsocial");
   assert.equal(posted.get("old_posts"),"0");
   assert.equal(posted.get("posts"),"3");
   assert.equal(posted.get("expiry"),"25/11/2026");
   return {ok:true,json:async()=>({order:"123456789"})};
  };
  const input={service:"9841",username:"litixsocial",min:"1000",max:"1000",
   posts:"3",old_posts:"0",delay:"0",expiry:"25/11/2026"};
  await assert.rejects(boosteroProduction("subscription",input,{fetcher:fake}),/not_authorized/);
  await assert.rejects(boosteroProduction("subscription",{...input,old_posts:"1"},{claimed:true,fetcher:fake}),/parameters_invalid/);
  await assert.rejects(boosteroProduction("subscription",{...input,posts:"31"},{claimed:true,fetcher:fake}),/parameters_invalid/);
  assert.equal(requests,0);
  const response=await boosteroProduction("subscription",input,{claimed:true,fetcher:fake});
  assert.equal(response.order,"123456789");
  assert.equal(requests,1);
 });
});
test("no billing or supplier operation occurs without launch flags",async()=>{
 await environment({...enabled,LITIX_NMI_RECURRING_MERCHANT_APPROVED:"false"},async()=>{
  const sql={query:async()=>{throw Error("must not touch DB")}};
  const operation=async()=>{throw Error("must not call supplier")};
  assert.equal((await reconcileNativeAutoLikes({sql})).enabled,false);
  assert.equal((await dispatchNativeAutoLikes({sql,operation})).enabled,false);
 });
});
test("paid receipts require matching subscription and nonexpired paid period",()=>{
 const paidAt=new Date(Date.now()-3600000).toISOString(),createdAt=new Date(Date.now()-86400000).toISOString();
 const subscription={id:"als_123",provider_subscription_id:"12345678",amount_cents:6000,created_at:createdAt};
 const evidence=nativeCycleEvidence({transactionId:"1029384",subscriptionId:"12345678",paidAt},subscription);
 assert.ok(evidence);
 assert.equal(evidence.subscriptionId,"als_123");
 assert.equal(evidence.amountCents,6000);
 assert.equal(nativeCycleEvidence({transactionId:"1029384",subscriptionId:"999",paidAt},subscription),null);
 assert.equal(nativeCycleEvidence({transactionId:"1029384",subscriptionId:"12345678",paidAt:"2020-01-01T00:00:00Z"},subscription),null);
});
test("paid cycle claim is atomic; ambiguous supplier results cannot place a second order",async()=>{
 await environment(enabled,async()=>{
  const expiry=new Date(Date.now()+20*86400000).toISOString();
  let claims=0, adds=0;
  const item={id:"alnc_example",subscription_id:"als_example",expires_at:expiry,
   amount_cents:6000,provider_transaction_id:"2345",platform:"instagram",
   target_profile_url:"https://www.instagram.com/litixsocial/",service_id:"9841",
   max_likes_per_post:1000,monthly_post_limit:10};
  const sql={query:async(q)=>{
   if(q.startsWith("select c.id"))return [item];
   if(q.startsWith("update public.litix_autolikes_native_cycles set state='DISPATCHING'")){
    claims++;
    return claims===1?[{id:item.id}]:[];
   }
   if(q.startsWith("update public.litix_autolikes_native_cycles set state='SUBMITTED'"))return [{id:item.id}];
   return [];
  }};
  const operation=async(action,params,opts)=>{
   if(action==="services")return [{service:"9841",name:"Instagram Auto Likes",category:"Instagram",
    type:"Subscriptions",rate:"1.0",min:"50",max:"200000"}];
   if(action==="balance")return {balance:"100",currency:"USD"};
   if(action==="subscription"){
    adds++;assert.equal(opts.claimed,true);assert.equal(params.posts,"10");
    return {order:"123456"};
   }
   throw Error("unexpected supplier action");
  };
  const first=await dispatchNativeAutoLikes({sql,operation});
  const second=await dispatchNativeAutoLikes({sql,operation});
  assert.equal(first.submitted,1);
  assert.equal(second.submitted,0);
  assert.equal(adds,1);
  assert.equal(claims,2);
 });
});
