import test from 'node:test';import assert from 'node:assert/strict';
import {createNmiMonthly} from '../lib/nmi-monthly-create.mjs';
const args={id:'order',quote:{amountCents:50,currency:'USD'},email:'test@example.test',paymentToken:'mock-token-only',startDate:'2027-01-15',securityKey:'mock-only'};
test('monthly creation sends exact amount, recurring consent schedule, and token only',async()=>{
 const r=await createNmiMonthly({...args,fetchImpl:async(url,init)=>{assert.equal(init.body.get('plan_amount'),'0.50');assert.equal(init.body.get('plan_payments'),'0');assert.equal(init.body.get('month_frequency'),'1');assert.equal(init.body.get('start_date'),'20270115');assert.equal(init.body.has('ccnumber'),false);assert.equal(init.body.has('type'),false);return new Response('response=1&subscription_id=123')}});assert.equal(r.state,'created');assert.equal(r.subscriptionId,'123');
});
test('creation acknowledgement requires unique valid subscription ID; no blind retries',async()=>{
 for(const body of ['response=1','response=1&subscription_id=123&subscription_id=124','response=3&subscription_id=123']){let calls=0;assert.equal((await createNmiMonthly({...args,fetchImpl:async()=>{calls++;return new Response(body)}})).state,'review');assert.equal(calls,1)}
 await assert.rejects(createNmiMonthly({...args,startDate:'2027-01-31'}));
});
