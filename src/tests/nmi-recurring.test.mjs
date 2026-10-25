import test from 'node:test';
import assert from 'node:assert/strict';
import {cancelRecurring} from '../lib/nmi-recurring.mjs';
const options={subscriptionId:'12345',securityKey:'mock-only'};
test('cancel adapter sends only delete_subscription, never a charge',async()=>{
 const result=await cancelRecurring({...options,fetchImpl:async(url,init)=>{
  assert.equal(url,'https://sandbox.nmi.com/api/transact.php');
  assert.equal(init.body.get('recurring'),'delete_subscription');assert.equal(init.body.has('type'),false);assert.equal(init.body.has('payment_token'),false);assert.equal(init.redirect,'error');return new Response('response=1');
 }});assert.equal(result.state,'renewal_stopped');
});
test('ambiguous cancellation never reports success and never retries',async()=>{
 for(const reply of ['','<html>Error</html>','response=1&response=3']){
  let calls=0;const r=await cancelRecurring({...options,fetchImpl:async()=>{calls++;return new Response(reply)}});assert.equal(r.state,'review');assert.equal(calls,1);
 }
 const r=await cancelRecurring({...options,fetchImpl:async()=>{throw Error('timeout')}});assert.equal(r.state,'review');assert.equal(r.code,'unknown_gateway_outcome');
});
test('rejection and invalid configuration stay fail-closed',async()=>{
 assert.equal((await cancelRecurring({...options,fetchImpl:async()=>new Response('response=3')})).state,'not_confirmed');
 await assert.rejects(cancelRecurring({...options,subscriptionId:'bad'}));
});
