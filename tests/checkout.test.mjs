import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/checkoutReadiness.js',import.meta.url),'utf8');
const {checkPaymentReadiness,displayOrderPrice}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const summary={ready:true,mode:'paykings'};
const response=data=>async()=>({ok:true,json:async()=>data});
test('price remains available independently of checkout errors',()=>{
  assert.equal(displayOrderPrice({rateUsd:100},59,'standard'),'$5.90');
  assert.equal(displayOrderPrice({rateUsd:100},59,'priority'),'$6.79');
});
test('invalid or missing catalog price is never shown as a free order',()=>{
  for(const s of [null,{rateUsd:0},{rateUsd:'invalid'}])assert.equal(displayOrderPrice(s,59,'standard'),'—');
});
test('only verified live merchant readiness permits checkout',async()=>{
  assert.deepEqual(await checkPaymentReadiness(summary,response({ready:true,customerChargesEnabled:true,merchantTestMode:false})),{ready:true,reason:null});
  for(const data of [{ready:true},{ready:true,customerChargesEnabled:true,merchantTestMode:true},{ready:false,customerChargesEnabled:false}]){
    assert.equal((await checkPaymentReadiness(summary,response(data))).ready,false);
  }
});
test('gateway errors and malformed responses fail closed',async()=>{
  for(const fetcher of [async()=>{throw Error('timeout')},async()=>({ok:false,json:async()=>({ready:true})}),async()=>({ok:true,json:async()=>{throw Error('bad JSON')}})]){
    assert.equal((await checkPaymentReadiness(summary,fetcher)).ready,false);
  }
});
test('unconfigured gateway makes no outgoing readiness request',async()=>{
  let called=false;
  assert.equal((await checkPaymentReadiness({ready:false},async()=>{called=true})).ready,false);
  assert.equal(called,false);
});
