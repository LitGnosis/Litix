import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import {verifyNmiMerchantWebhook,verifyStripeWebhook,selectProvider} from '../lib/payments/signatures.ts';
import {normalizeNmiEvent,normalizeStripeEvent,centsFromDecimal} from '../lib/payments/normalize.ts';

const raw='{"event_id":"evt-a","event_type":"transaction.sale.success"}';

test('NMI merchant signature verifies nonce dot raw payload, rejects modified bytes',()=>{
  const key='a'.repeat(48),nonce='f3c1e9a2b7d84c15';
  const signature=createHmac('sha256',key).update(`${nonce}.${raw}`).digest('hex');
  const header=`t=${nonce},s=${signature}`;
  assert.equal(verifyNmiMerchantWebhook(raw,header,key),true);
  assert.equal(verifyNmiMerchantWebhook(raw+' ',header,key),false);
  assert.equal(verifyNmiMerchantWebhook(raw,header,'another-key'),false);
  assert.equal(verifyNmiMerchantWebhook(raw,'t=wrong,s=bad',key),false);
});

test('Stripe timestamped signature verifies and blocks stale replay',()=>{
  const key='whsec_'+'x'.repeat(40),now=1794354000;
  const signature=createHmac('sha256',key).update(`${now}.${raw}`).digest('hex');
  assert.equal(verifyStripeWebhook(raw,`t=${now},v1=${signature}`,key,now),true);
  assert.equal(verifyStripeWebhook(raw,`t=${now},v1=${signature}`,key,now+400),false);
  assert.equal(verifyStripeWebhook(raw,`t=${now},v1=${signature.slice(1)}0`,key,now),false);
});

test('provider detection rejects combined or unsigned webhooks',()=>{
  assert.equal(selectProvider(new Headers()),null);
  assert.equal(selectProvider(new Headers({'Webhook-Signature':'x'})),'nmi');
  assert.equal(selectProvider(new Headers({'Stripe-Signature':'x'})),'stripe');
  assert.equal(selectProvider(new Headers({'Webhook-Signature':'x','Stripe-Signature':'x'})),null);
});

test('money parser never rounds invalid values and requires real amount',()=>{
  assert.equal(centsFromDecimal('24.12'),2412);
  assert.equal(centsFromDecimal('24.1'),2410);
  assert.equal(centsFromDecimal('1.001'),null);
  assert.equal(centsFromDecimal('-1.00'),null);
});

test('NMI auth never triggers payment dispatch',()=>{
  const body={event_id:'test_nmi_a',event_type:'transaction.auth.success',event_body:{
    merchant:{id:'123'},features:{is_test_mode:false},transaction_id:'tx1',transaction_type:'cc',
    order_id:'o1',currency:'USD',action:{success:'1',amount:'10.00'}}};
  assert.equal(normalizeNmiEvent(body)?.action,'review');
  assert.equal(normalizeNmiEvent({...body,event_type:'transaction.sale.success'})?.action,'pending_settlement');
  assert.equal(normalizeNmiEvent({event_id:'s1',event_type:'settlement.batch.complete',event_body:{merchant:{id:'123'},transaction_ids:['tx1']}})?.action,'settlement_batch');
});

test('Stripe requires successful captured payment-intent, not checkout redirect',()=>{
  const base={id:'evt_123',type:'payment_intent.succeeded',livemode:true,data:{object:{id:'pi_123',status:'succeeded',
    amount_received:2500,currency:'usd',metadata:{litixOrderId:'o_123'}}}};
  assert.equal(normalizeStripeEvent(base)?.action,'captured');
  assert.equal(normalizeStripeEvent({...base,type:'payment_intent.payment_failed'})?.action,'review');
  assert.equal(normalizeStripeEvent({...base,data:{object:{...base.data.object,status:'requires_capture'}}})?.action,'review');
  assert.equal(normalizeStripeEvent({...base,type:'checkout.session.completed'}),null);
});
