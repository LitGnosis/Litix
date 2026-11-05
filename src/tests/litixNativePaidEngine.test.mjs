import test from "node:test";
import assert from "node:assert/strict";
import {nativePaidQuote,nativeOrderToken,nativeTokenValid,verifyNativeNmiSettlement} from "../lib/litixNativeCommercePolicy.mjs";
import {checkoutNativePaid,statusNativePaid,sendNativePaidDelivery,nmiSettledFor,quoteNativeOffer} from "../lib/litixNativePaidEngine.mjs";
const key="no-real-secrets-"+ "X".repeat(48);
const prod={VERCEL_ENV:"production",LITIX_NATIVE_PAID_ENABLED:"true",
 LITIX_NATIVE_PRICES_JSON:JSON.stringify({
  "litix-native-caption-kit":{priceCents:699,costCents:50,supportReserveCents:100},
  "litix-native-link-page":{priceCents:799,costCents:60,supportReserveCents:120},
  "litix-native-campaign-plan":{priceCents:999,costCents:80,supportReserveCents:150}
 }),NMI_SECURITY_KEY:"test-only-nmi-credential",
 RESEND_API_KEY:"test-only-resend",LITIX_NATIVE_ORDER_SECRET:key};
const brief={business:"Studio Seven",audience:"local businesses",offer:"a custom campaign plan",action:"Book a call",platform:"Instagram",website:"https://example.com"};
const requestId="11111111-1111-4111-8111-111111111111";
const input={serviceId:"litix-native-campaign-plan",brief,requestId,email:"Customer@example.com",
 paymentToken:"GATEWAY_TOKEN_ACCEPTED_12345",expectedAmountCents:999};
function mockSql(){
 const orders=[],emails=[];
 return {orders,emails,async query(sql,args){
  if(sql.startsWith("insert into public.litix_native_paid_orders")){
   if(orders.some(x=>x.request_id===args[1]))return [];
   const [id,request_id,email,service_id,brief_hash,amount_cents,cost_budget_cents,
    filename,mime_type,sha256,content,token_hash]=args;
   orders.push({id,request_id,email,service_id,brief_hash,amount_cents,cost_budget_cents,
    filename,mime_type,sha256,content,token_hash,payment_state:"PENDING",
    delivery_state:"LOCKED",updated_at:new Date().toISOString(),gateway_transaction_id:null});
   return [{id}];
  }
  if(sql.startsWith("update public.litix_native_paid_orders set payment_state='PROCESSING'")){
   const row=orders.find(o=>o.id===args[0]&&o.payment_state==="PENDING");
   if(!row)return [];
   row.payment_state="PROCESSING";return [{id:row.id}];
  }
  if(sql.startsWith("update public.litix_native_paid_orders set payment_state=$2")){
   const row=orders.find(x=>x.id===args[0]&&x.payment_state==="PROCESSING");
   if(row){row.payment_state=args[1];row.gateway_transaction_id=args[2];}
   return [];
  }
  if(sql.startsWith("select id,email,amount_cents")){
   return orders.filter(x=>x.id===args[0]&&x.token_hash===args[1]);
  }
  if(sql.startsWith("with confirmed as (update")){
   const row=orders.find(x=>x.id===args[0]&&x.gateway_transaction_id===args[1]&&x.payment_state==="APPROVED_UNVERIFIED");
   if(row){row.payment_state="PAID";row.delivery_state="READY";
    if(!emails.some(x=>x.id===row.id))emails.push({id:row.id,event:"PAID_DELIVERY",state:"PENDING"});}
   return [];
  }
  if(sql.startsWith("with claimed as (update public.litix_native_email_outbox")){
   const event=emails.find(x=>x.id===args[0]&&x.state==="PENDING"),row=orders.find(x=>x.id===args[0]);
   if(!event||!row||row.payment_state!=="PAID")return [];
   event.state="SENDING";return [{id:row.id,email:row.email,filename:row.filename}];
  }
  if(sql.startsWith("update public.litix_native_email_outbox set state=$2")){
   const e=emails.find(x=>x.id===args[0]);if(e&&e.state==="SENDING")e.state=args[1];return [];
  }
  throw Error("Unmocked query family: "+sql.slice(0,80));
 }};
}
const report=(id,options={})=>"<nm_response><transaction>"+
 "<transaction_id>"+(options.id||"5678912")+"</transaction_id>"+
 "<order_id>"+(options.order||id)+"</order_id>"+
 "<currency>"+(options.currency||"USD")+"</currency>"+
 "<condition>"+(options.condition||"complete")+"</condition>"+
 "<action><action_type>sale</action_type><success>1</success><amount>"+(options.amount||"9.99")+"</amount></action>"+
 (options.refund?"<action><action_type>refund</action_type><success>1</success></action>":"")+
 "</transaction></nm_response>";
function network(sql,{sale="approve",settled=true}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  const action=url.includes("transact.php")?"sale":url.includes("query.php")?"query":"email";
  calls.push(action);
  if(action==="sale"){
   if(sale==="timeout")throw Error("timeout");
   if(sale==="decline")return {ok:true,text:async()=>"response=2&responsetext=Declined"};
   return {ok:true,text:async()=>"response=1&transactionid=5678912"};
  }
  if(action==="query"){
   const id=sql.orders[0]?.id||"00000000-0000-4000-8000-000000000000";
   return {ok:true,text:async()=>report(id,{condition:settled?"complete":"pendingsettlement"})};
  }
  return {ok:true,text:async()=>"{\"id\":\"test-mail\"}"};
 };
 return {calls,fetcher};
}
test("No native paid route or quotes without explicit enablement and approved prices",async()=>{
 const x=await checkoutNativePaid({data:input,env:{...prod,LITIX_NATIVE_PAID_ENABLED:"false"},sql:mockSql()});
 assert.equal(x.http,503);assert.equal(x.body.charged,false);
 assert.equal(quoteNativeOffer({serviceId:input.serviceId,brief,env:{...prod,LITIX_NATIVE_PRICES_JSON:"{}"}}).http,503);
});
test("Per-product unit economics are server-owned and reject negative margin",()=>{
 const q=nativePaidQuote({serviceId:input.serviceId,brief,env:prod});
 assert.equal(q.priceCents,999);assert.equal(q.asset.publiclyPurchasable,false);
 assert.ok(q.estimatedMarginCents>Math.ceil(q.priceCents*.25));
 const bad={...prod,LITIX_NATIVE_PRICES_JSON:JSON.stringify({
  "litix-native-campaign-plan":{priceCents:300,costCents:200,supportReserveCents:75}})};
 assert.throws(()=>nativePaidQuote({serviceId:input.serviceId,brief,env:bad}),/MARGIN_BELOW_FLOOR/);
});
test("HMAC order links require original signing secret",()=>{
 const id="11111111-1111-4111-8111-111111111111",token=nativeOrderToken(id,key);
 assert.equal(token.length,64);
 assert.equal(nativeTokenValid(id,token,key),true);
 assert.equal(nativeTokenValid(id,token,"different-"+"Z".repeat(45)),false);
});
test("Reject mismatched or incomplete NMI settlement, credit/refund and wrong amount",()=>{
 const id="11111111-1111-4111-8111-111111111111";
 for(const o of [{condition:"pendingsettlement"},{amount:"8.99"},{refund:true},
  {order:"22222222-2222-4222-8222-222222222222"},{currency:"EUR"},{id:"000000"}]){
  const x=verifyNativeNmiSettlement(report(id,o),{orderId:id,transactionId:"5678912",amountCents:999});
  assert.equal(x.settled,false);
 }
 assert.equal(verifyNativeNmiSettlement(report(id),{orderId:id,transactionId:"5678912",amountCents:999}).settled,true);
});
test("Approved NMI sale is not automatically delivered before independent settlement",async()=>{
 const sql=mockSql(),networked=network(sql,{settled:false});
 const x=await checkoutNativePaid({data:input,env:prod,sql,fetcher:networked.fetcher});
 assert.equal(x.http,202);
 assert.equal(x.body.payment,"APPROVED_UNVERIFIED");
 assert.equal(sql.orders[0].delivery_state,"LOCKED");
 assert.deepEqual(networked.calls,["sale"]);
 sql.orders[0].updated_at=new Date(Date.now()-60000).toISOString();
 const y=await statusNativePaid({orderId:x.body.orderId,token:x.body.token,env:prod,sql,fetcher:networked.fetcher});
 assert.equal(y.body.delivered,false);
 assert.equal(y.http,202);
 assert.equal(sql.orders[0].payment_state,"APPROVED_UNVERIFIED");
});
test("One idempotency key can submit at most one paid sale, even with repeated POST",async()=>{
 const sql=mockSql(),networked=network(sql);
 const a=await checkoutNativePaid({data:input,env:prod,sql,fetcher:networked.fetcher});
 const b=await checkoutNativePaid({data:input,env:prod,sql,fetcher:networked.fetcher});
 assert.equal(a.http,202);assert.equal(b.http,409);
 assert.equal(networked.calls.filter(x=>x==="sale").length,1);
 assert.equal(sql.orders.length,1);
});
test("Settled NMI sale unlocks exactly one download and one durable email event",async()=>{
 const sql=mockSql(),n=network(sql);
 const initial=await checkoutNativePaid({data:input,env:prod,sql,fetcher:n.fetcher});
 assert.equal(initial.http,202);
 sql.orders[0].updated_at=new Date(Date.now()-70000).toISOString();
 const paid=await statusNativePaid({orderId:initial.body.orderId,token:initial.body.token,env:prod,sql,fetcher:n.fetcher});
 assert.equal(paid.http,200);assert.equal(paid.body.delivered,true);
 assert.match(paid.body.content,/Studio Seven/);
 assert.equal(sql.emails.length,1);
 const sent=await sendNativePaidDelivery({orderId:initial.body.orderId,env:prod,sql,fetcher:n.fetcher});
 assert.equal(sent.state,"SENT");
 const again=await sendNativePaidDelivery({orderId:initial.body.orderId,env:prod,sql,fetcher:n.fetcher});
 assert.equal(again.state,"ALREADY_CLAIMED_OR_NOT_SETTLED");
 assert.equal(n.calls.filter(x=>x==="email").length,1);
});
test("Ambiguous NMI timeout requires reconciliation, never resubmits or unlocks",async()=>{
 const sql=mockSql(),n=network(sql,{sale:"timeout"});
 const first=await checkoutNativePaid({data:input,env:prod,sql,fetcher:n.fetcher});
 assert.equal(first.body.payment,"REVIEW");
 assert.equal(first.http,202);
 assert.equal(sql.orders[0].delivery_state,"LOCKED");
 const replay=await checkoutNativePaid({data:input,env:prod,sql,fetcher:n.fetcher});
 assert.equal(replay.http,409);assert.deepEqual(n.calls,["sale"]);
});
test("Declined card does not deliver, and no new charge occurs on retry",async()=>{
 const sql=mockSql(),n=network(sql,{sale:"decline"});
 const result=await checkoutNativePaid({data:input,env:prod,sql,fetcher:n.fetcher});
 assert.equal(result.http,402);
 assert.equal(result.body.delivered,false);
 assert.equal(sql.orders[0].payment_state,"DECLINED");
});
test("Reject unsupported first-party SKU, unapproved pricing and malformed Collect token",async()=>{
 const sql=mockSql(),n=network(sql);
 const invalid=await checkoutNativePaid({data:{...input,serviceId:"litix-native-followers"},env:prod,sql,fetcher:n.fetcher});
 const token=await checkoutNativePaid({data:{...input,paymentToken:"4111111111111111"},env:prod,sql,fetcher:n.fetcher});
 const mismatch=await checkoutNativePaid({data:{...input,expectedAmountCents:700},env:prod,sql,fetcher:n.fetcher});
 assert.equal(invalid.http,503);assert.equal(token.http,422);assert.equal(mismatch.http,409);
 assert.equal(sql.orders.length,0);
});
test("Cannot fetch private file without exact HMAC token",async()=>{
 const sql=mockSql(),n=network(sql);
 const a=await checkoutNativePaid({data:input,env:prod,sql,fetcher:n.fetcher});
 const x=await statusNativePaid({orderId:a.body.orderId,token:"a".repeat(64),env:prod,sql,fetcher:n.fetcher});
 assert.equal(x.http,403);assert.equal(x.body.delivered,false);
});
