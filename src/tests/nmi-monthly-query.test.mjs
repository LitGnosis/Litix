import test from 'node:test';import assert from 'node:assert/strict';
import {verifyMonthlyTransaction,queryMonthlyTransaction} from '../lib/nmi-monthly-query.mjs';
const subscription={id:'local-order',email:'test@example.test',provider_subscription_id:'123',amount_cents:50};
// Synthetic fixture based on NMI's documented transaction fields; no real card data.
const xml='<nm_response><transaction><transaction_id>456</transaction_id><order_id>local-order</order_id><email>test@example.test</email><currency>USD</currency><condition>complete</condition><action><amount>0.50</amount><action_type>sale</action_type><source>recurring</source><success>1</success><response_code>100</response_code></action></transaction></nm_response>';
const verify=x=>verifyMonthlyTransaction(x,{transactionId:'456',subscription});
test('only matched settled recurring payment is verified; period is not invented',()=>{const r=verify(xml);assert.equal(r.approved,true);assert.equal(r.amountCents,50);assert.equal(r.periodEnd,undefined)});
test('declines, unsettled payments, mismatches and complex actions do not grant coverage',()=>{
 for(const [a,b] of [['complete','pendingsettlement'],['complete','failed'],['0.50','5.60'],['USD','EUR'],['local-order','wrong'],['test@example.test','other@example.test'],['<success>1','<success>0'],['<source>recurring','<source>api'],['<action_type>sale','<action_type>refund']])assert.throws(()=>verify(xml.replace(a,b)));
 assert.throws(()=>verify(xml.replace('</transaction>','<action><success>1</success></action></transaction>')));
});
test('malformed XML, entities, duplicate fields or transactions are rejected',()=>{
 for(const x of ['<bad>','<!DOCTYPE x>'+xml,xml.replace('</currency>','</currency><currency>USD</currency>'),xml.replace('</nm_response>',xml+'</nm_response>')])assert.throws(()=>verify(x));
});
test('read-only server query is scoped to transaction and provider subscription',async()=>{
 let calls=0;const result=await queryMonthlyTransaction({transactionId:'456',subscription,securityKey:'mock-only',fetchImpl:async(url,init)=>{calls++;assert.match(url,/query.php$/);assert.equal(init.body.get('subscription_id'),'123');assert.equal(init.body.get('transaction_id'),'456');assert.equal(init.body.has('recurring'),false);return new Response(xml)}});assert.equal(result.approved,true);assert.equal(calls,1);
});
