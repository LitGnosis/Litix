import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBundleSettlement,exactBundleItems} from '../lib/packageSettlement.mjs';
const purchase={id:'pkg_test',customer_id:'customer',email:'a@example.com',price_cents:4485,payment_provider:'paykings',status:'pending_payment',payment_reference:'ltx_order'};
const order={id:'ltx_order',customer_id:'customer',customer_email:'a@example.com',retail_cents:4485,payment_provider:'paykings',payment_status:'paid',payment_reference:'123456'};
const ledger={order_id:'ltx_order',customer_id:'customer',billing_email:'a@example.com',amount_cents:4485,currency:'USD',payment_state:'settled',gateway_transaction_id:'123456'};
test('accepts matching server-verified settled bundle',()=>{
 assert.deepEqual(validateBundleSettlement(purchase,order,ledger),{purchaseId:'pkg_test',orderId:'ltx_order',transactionId:'123456'});
});
test('rejects unpaid, wrong amount, identity and transaction evidence',()=>{
 for(const change of [{payment_status:'pending'},{retail_cents:1},{customer_id:'another'},{customer_email:'b@example.com'},{payment_reference:'654321'},{payment_provider:'wallet'}])assert.throws(()=>validateBundleSettlement(purchase,{...order,...change},ledger));
 for(const change of [{payment_state:'awaiting_settlement'},{currency:'EUR'},{amount_cents:1},{customer_id:'another'},{billing_email:'b@example.com'},{gateway_transaction_id:'bad'},{order_id:'other'}])assert.throws(()=>validateBundleSettlement(purchase,order,{...ledger,...change}));
 for(const change of [{status:'active'},{payment_reference:'other'},{price_cents:0},{payment_provider:'wallet'}])assert.throws(()=>validateBundleSettlement({...purchase,...change},order,ledger));
});
test('exact advertised launch credits are retained',()=>{
 const items={Likes:25000,Views:100000,Impressions:10000,Shares:1000,Saves:1000,Reposts:100};
 assert.deepEqual(Object.fromEntries(exactBundleItems(items).map(x=>[x.kind,x.quantity])),items);
 for(const input of [null,{},[],{Likes:0},{Likes:1.5},{Followers:100},{Likes:'25000'}])assert.throws(()=>exactBundleItems(input));
});
