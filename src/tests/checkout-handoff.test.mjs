import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const helper=new URL('../lib/checkoutHandoff.mjs',import.meta.url);
let source=readFileSync(new URL('../patches/checkout-handoff/paymentGateway.js',import.meta.url),'utf8')
  .replace("import {checkPaymentReadiness} from './checkoutReadiness';",'');
if(existsSync(helper))source=source.replace("'./checkoutHandoff.mjs'",JSON.stringify(asModule(readFileSync(helper,'utf8'))));
const {createPaymentCheckout}=await import(asModule(source));
const id='ltx_12345678-1234-1234-1234-123456789012';
const bridge='https://litix-paykings-webhook.vercel.app';
const path='/api/payments/paykings/card-entry';
const session='a'.repeat(100);
async function checkout(url,reference=id){
  const oldFetch=globalThis.fetch,oldEnv={...process.env};
  Object.assign(process.env,{LITIX_PAYMENT_GATEWAY:'paykings',LITIX_PAYKINGS_API_URL:bridge,LITIX_PAYKINGS_BRIDGE_SECRET:'unit-test-placeholder',LITIX_PAYKINGS_CHECKOUT_ACTIVE:'true'});
  globalThis.fetch=async()=>({ok:true,json:async()=>({url,reference})});
  try{return await createPaymentCheckout({orderId:id})}finally{globalThis.fetch=oldFetch;process.env=oldEnv}
}
test('accepts existing bridge encrypted-session handoff with matching order',async()=>{
 const url=bridge+path+'?session='+session;
 assert.deepEqual(await checkout(url),{provider:'paykings',reference:id,url});
});
test('retains direct NMI hosted checkout support',async()=>{
 for(const host of ['secure.nmi.com','sandbox.nmi.com','secure.networkmerchants.com'])assert.equal((await checkout('https://'+host+'/form')).url,'https://'+host+'/form');
});
test('rejects untrusted, malformed and broadened bridge destinations',async()=>{
 for(const url of [bridge+'/other?session='+session,bridge+path,bridge+path+'?session=short',bridge+path+'?session='+session+'&session='+session,bridge+path+'?session='+session+'&redirect=https://example.com',bridge+path+'?session='+session+'#fragment',bridge.replace('https:','http:')+path+'?session='+session,bridge.replace('.app','.app.attacker.example')+path+'?session='+session,'https://user:pass@secure.nmi.com/form','https://secure.nmi.com:8443/form',bridge.replace('https://','https://user@')+path+'?session='+session])await assert.rejects(checkout(url),/Invalid gateway response/);
});
test('retains exact order-reference binding for both handoff types',async()=>{
 for(const url of [bridge+path+'?session='+session,'https://secure.nmi.com/form']){
  for(const reference of [undefined,null,'another-order',123])await assert.rejects(checkout(url,reference===undefined?'':reference),/Invalid gateway response/);
 }
});
test('final overlay installs tested gateway after all legacy overlays', async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {execFileSync}=await import('node:child_process');
 const root=mkdtempSync(join(tmpdir(),'litix-handoff-'));
 try{
  mkdirSync(join(root,'lib'));
  writeFileSync(join(root,'lib/paymentGateway.js'),readFileSync(new URL('../patches/retire-integrations/paymentGateway.js',import.meta.url)));
  const apply=new URL('../patches/checkout-handoff/apply.cjs',import.meta.url);
  for(let i=0;i<2;i++)execFileSync(process.execPath,[apply.pathname],{cwd:root});
  assert.equal(readFileSync(join(root,'lib/paymentGateway.js'),'utf8'),readFileSync(new URL('../patches/checkout-handoff/paymentGateway.js',import.meta.url),'utf8'));
  const build=readFileSync(new URL('../scripts/vercel-build.sh',import.meta.url),'utf8');
  assert.match(build,/protected-refill\/apply\.cjs && node patches\/checkout-handoff\/apply\.cjs && node --test/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
