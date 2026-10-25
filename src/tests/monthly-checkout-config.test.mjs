import test from 'node:test';import assert from 'node:assert/strict';
import {previewAccountsAllowed,monthlyCheckoutConfig} from '../lib/monthly-checkout-config.mjs';
import {sendManagementEmail} from '../lib/monthly-mailer.mjs';
const env={VERCEL_ENV:'preview',LITIX_CUSTOMER_ACCOUNTS_ENABLED:'true',LITIX_CUSTOMER_DATABASE_VERIFIED:'true',LITIX_MONTHLY_PURCHASE_ENABLED:'true',NMI_GATEWAY_MODE:'TEST',NMI_TEST_SECURITY_KEY:'fixture',NMI_TEST_GATEWAY_URL:'https://sandbox.nmi.com/api/transact.php',NMI_TEST_TOKENIZATION_KEY:'public-fixture',LITIX_MONTHLY_DATABASE_URL:'fixture',RESEND_API_KEY:'fixture',EMAIL_FROM:'fixture@example.test',LITIX_MONTHLY_APPROVED_START_DATE:'2099-01-01'};
test('account gate cannot be activated in production or without database verification',()=>{
 assert.equal(previewAccountsAllowed(env),true);
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_ENV:undefined},{LITIX_CUSTOMER_DATABASE_VERIFIED:'false'}]){assert.equal(previewAccountsAllowed({...env,...patch}),false);assert.throws(()=>monthlyCheckoutConfig({...env,...patch}))}
});
test('checkout exposes only sandbox public key and approved date; refuses live fallback',()=>{
 assert.deepEqual(monthlyCheckoutConfig(env),{publicKey:'public-fixture',startDate:'2099-01-01'});
 for(const patch of [{NMI_GATEWAY_MODE:'LIVE'},{NMI_TEST_TOKENIZATION_KEY:''},{NMI_TEST_GATEWAY_URL:'https://secure.nmi.com/api/transact.php'},{LITIX_MONTHLY_APPROVED_START_DATE:'2020-01-01'},{LITIX_MONTHLY_APPROVED_START_DATE:'2099-02-30'}])assert.throws(()=>monthlyCheckoutConfig({...env,...patch}));
});
test('management email remains on exact Preview origin and token stays in fragment',async()=>{
 await sendManagementEmail({id:'fixture',email:'test@example.test',token:'a'.repeat(43),apiKey:'fixture',from:'fixture@example.test',baseUrl:'https://exact-preview.vercel.app',fetchImpl:async(url,init)=>{const body=JSON.parse(init.body);assert.match(body.text,/https:\/\/exact-preview.vercel.app\/subscriptions\/manage#token=/);assert.doesNotMatch(body.text,/https:\/\/litix.net/);return Response.json({id:'fixture'})}});
});
import {customerReceipt} from '../lib/monthly-receipt.mjs';
test('receipts require exact server subject and settled transaction; invalid IDs never query',async()=>{
 let calls=0;const sql={query:async(q,p)=>{calls++;assert.match(q,/customer_subject=\$1 and p.transaction_id=\$2/);assert.deepEqual(p,['owner','123']);return [{transaction_id:'123',amount_cents:560}]}};
 assert.equal((await customerReceipt(sql,'owner','123')).kind,'verified_payment_receipt');
 assert.equal(await customerReceipt(sql,'owner','../bad'),null);assert.equal(calls,1);
 assert.equal(await customerReceipt({query:async()=>[]},'other','123'),null);
});
