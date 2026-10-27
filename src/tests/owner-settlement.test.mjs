import test from "node:test";
import assert from "node:assert/strict";
import {ownerCoveredCardTotal,verifyOwnerQueryXml,verifyOwnerPaymentSettlement} from "../lib/ownerSettlement.mjs";
import {ownerReconcileSettlement} from "../lib/ownerWholesaleOrders.mjs";

test("owner PayKings total covers percentage charged on gross plus fixed fee",()=>{
 const x=ownerCoveredCardTotal(1000,290,30);
 assert.equal(x.totalCents,1061);
 assert.equal(x.feeCents,61);
 assert.ok(x.totalCents*(1-0.029)-30>=1000);
 assert.throws(()=>ownerCoveredCardTotal(1000,10000,0),/owner_card_fee_not_verified/);
});
test("settlement requires matching transaction, order, amount, successful sale and actual settle action",async()=>{
 const orderId="low_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const args={orderId,transactionId:"123456789",totalCents:1061};
 const good="<nm_response><transaction><transaction_id>123456789</transaction_id><order_id>"+orderId+"</order_id>"+
 "<condition>complete</condition><currency>USD</currency>"+
 "<action><action_type>sale</action_type><success>1</success><response_code>100</response_code><amount>10.61</amount></action>"+
 "<action><action_type>settle</action_type><success>1</success></action></transaction></nm_response>";
 assert.equal(verifyOwnerQueryXml(good,args),true);
 assert.equal(verifyOwnerQueryXml(good.replace("<condition>complete</condition>","<condition>pending</condition>"),args),false);
 assert.equal(verifyOwnerQueryXml(good.replace("<action_type>settle</action_type>","<action_type>refund</action_type>"),args),false);
 assert.equal(verifyOwnerQueryXml(good.replace("<amount>10.61</amount>","<amount>10.60</amount>"),args),false);
 assert.equal(verifyOwnerQueryXml(good.replace(orderId,"low_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),args),false);
 const old=Object.fromEntries(["VERCEL_ENV","LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED","NMI_SECURITY_KEY"].map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{VERCEL_ENV:"production",LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED:"true",NMI_SECURITY_KEY:"FAKE_LOCAL_ONLY"});
  assert.equal((await verifyOwnerPaymentSettlement(args,{fetcher:async()=>new Response(good)})).settled,true);
  assert.equal((await verifyOwnerPaymentSettlement(args,{fetcher:async()=>new Response(good.replace("<condition>complete</condition>","<condition>pending</condition>"))})).settled,false);
  process.env.LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED="false";
  assert.equal((await verifyOwnerPaymentSettlement(args,{fetcher:async()=>{throw Error("MUST NOT FETCH")}})).settled,false);
 }finally{for(const [k,v] of Object.entries(old))v===undefined?delete process.env[k]:process.env[k]=v}
});
test("concurrent owner settlement requests submit at most one supplier order",async()=>{
 const keys=["VERCEL_ENV","LITIX_OWNER_WHOLESALE_PURCHASES","LITIX_OWNER_PAYKINGS_ENABLED","LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED","NMI_SECURITY_KEY","NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY","LITIX_OWNER_PAYKINGS_FEE_BPS","LITIX_OWNER_PAYKINGS_FEE_FIXED_CENTS"];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{VERCEL_ENV:"production",LITIX_OWNER_WHOLESALE_PURCHASES:"true",
  LITIX_OWNER_PAYKINGS_ENABLED:"true",LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED:"true",NMI_SECURITY_KEY:"FAKE",
  NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY:"fake-public",LITIX_OWNER_PAYKINGS_FEE_BPS:"290",LITIX_OWNER_PAYKINGS_FEE_FIXED_CENTS:"30"});
 const id="low_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 let paid=false,claimed=false,adds=0;
 const o={id,owner_sub:"auth0|exact_owner_123",provider:"boostero",supplier_service_id:"5461",
  destination:"https://www.instagram.com/test/",quantity:1000,supplier_cost_cents:300,total_charge_cents:340,
  payment_method:"paykings",payment_state:"processing",settlement_state:"pending",payment_transaction_id:"123456789"};
 const db={query:async(sql)=>{
  if(sql.startsWith("select * from public.litix_owner_wholesale_orders where id=$1 and owner_sub=$2 and payment_method"))return [{...o,payment_state:paid?"paid":"processing"}];
  if(sql.startsWith("update public.litix_owner_wholesale_orders set payment_state='paid'")){
   if(paid)return [];paid=true;return [{id}];
  }
  if(sql.startsWith("update public.litix_owner_wholesale_orders set state='DISPATCHING'")){
   if(claimed)return [];claimed=true;return [{...o,attempt_id:"attempt-1"}];
  }
  if(sql.startsWith("insert into public.litix_owner_wholesale_attempts"))return [];
  if(sql.startsWith("update public.litix_owner_wholesale_orders set state='SUBMITTED'"))return [{id}];
  return [];
 }};
 const operation=async(provider,action)=>{
  if(action==="balance")return {balance:100};
  if(action==="add"){adds++;return {order:789123}}
  throw Error("no other supplier action expected");
 };
 const quoteProvider=async()=>({wholesaleCents:300,totalCents:340});
 try{
  const x=await ownerReconcileSettlement(o.owner_sub,id,{db,quoteProvider,operation,verify:async()=>({settled:false,reason:"unsettled"})});
  assert.equal(x.submitted,false);assert.equal(adds,0);
  const results=await Promise.all(Array.from({length:5},()=>ownerReconcileSettlement(o.owner_sub,id,{
    db,quoteProvider,operation,verify:async()=>({settled:true})})));
  assert.equal(adds,1);
  assert.equal(results.filter(r=>r.submitted===true).length,1);
 }finally{for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v}
});
