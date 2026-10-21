import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmationState,savedCheckoutReference} from '../lib/orderConfirmation.mjs';
test('only verified paid orders confirm; completion requires fulfillment',()=>{
 assert.equal(confirmationState({paymentStatus:'pending',fulfillmentStatus:'completed'}),'pending');
 assert.equal(confirmationState({paymentStatus:'paid',fulfillmentStatus:'submitted'}),'confirmed');
 assert.equal(confirmationState({paymentStatus:'paid',fulfillmentStatus:'completed'}),'completed');
 assert.equal(confirmationState({paymentStatus:'failed'}),'failed');
});
test('same-tab reference is bounded and malformed values rejected',()=>{
 const value={order_id:'ltx_123',email:'customer@example.com',createdAt:100};
 assert.deepEqual(savedCheckoutReference(JSON.stringify(value),101),{order_id:value.order_id,email:value.email});
 for(const raw of ['bad',null,JSON.stringify({...value,createdAt:1})])assert.equal(savedCheckoutReference(raw,86400002),null);
});
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('final overlay restores automatic pages after legacy patches and is idempotent',()=>{
 const root=mkdtempSync(join(tmpdir(),'confirmation-'));
 try{
  for(const dir of ['app/track','app/success','lib'])mkdirSync(join(root,dir),{recursive:true});
  writeFileSync(join(root,'app/OrderWidget.js'),'location.href=j.url');
  const overlay=new URL('../patches/automatic-confirmation/apply.cjs',import.meta.url);
  for(let i=0;i<2;i++)execFileSync(process.execPath,[overlay.pathname],{cwd:root});
  assert.equal(readFileSync(join(root,'app/OrderWidget.js'),'utf8').split('sessionStorage.setItem').length,2);
  for(const file of ['app/CheckoutConfirmation.js','app/track/page.js','app/success/page.js','lib/orderConfirmation.mjs'])assert.equal(readFileSync(join(root,file),'utf8'),readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 }finally{rmSync(root,{force:true,recursive:true})}
});
