import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Import the actual route with only its database transport replaced. All fetches
// are intercepted; these tests cannot charge a card or submit a supplier order.
const source=readFileSync(new URL('../app/api/[action]/route.js',import.meta.url),'utf8')
 .replace('import { neon } from "@neondatabase/serverless";', 'const neon=()=>globalThis.__litixTestDatabase;');
const cases=[
 ['price changed', {expectedAmountCents:799}, 409, 0, 0],
 ['price omitted', {expectedAmountCents:undefined}, 409, 0, 0],
 ['below minimum', {rate:1,expectedAmountCents:250}, 422, 0, 0],
 ['approved', {}, 200, 1, 1],
 ['approved without transaction ID', {gateway:'missing-transaction'}, 202, 1, 0],
 ['declined', {gateway:'declined'}, 402, 1, 0],
 ['uncertain payment', {gateway:'timeout'}, 202, 1, 0],
 ['duplicate checkout', {duplicate:true}, 409, 0, 0],
 ['supplier timeout after payment', {supplierTimeout:true}, 202, 1, 1],
];
for(const [label,options,status,payments,orders] of cases){
 test(label,async t=>{
  const originalFetch=globalThis.fetch;
  const originalDatabase=globalThis.__litixTestDatabase;
  const keys=['DATABASE_URL','BOOSTERO_API_KEY','BOOSTERO_API_URL','NMI_SECURITY_KEY','PAYKINGS_NMI_COLLECT_PUBLIC_KEY'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  keys.forEach(k=>process.env[k]='test-only');
  process.env.BOOSTERO_API_URL='https://boostero.example/api/v2';
  let paymentCalls=0,orderCalls=0,dbCalls=0;
  globalThis.__litixTestDatabase={query:async sql=>{dbCalls++;return sql.startsWith('insert')?(options.duplicate?[]:[{id:'test-order'}]):[];}};
  globalThis.fetch=async(url,init)=>{
   if(String(url)==='https://paykings.transactiongateway.com/api/transact.php'){
    paymentCalls++;
    if(options.gateway==='timeout')throw Error('simulated timeout');
    return new Response(options.gateway==='declined'?'response=2&responsetext=Declined':options.gateway==='missing-transaction'?'response=1&responsetext=Approved':'response=1&transactionid=test-only');
   }
   assert.equal(String(url),'https://boostero.example/api/v2');
   const action=JSON.parse(init.body).action;
   if(action==='services')return Response.json([{service:1,name:'USA Instagram likes with refill and no drop',category:'USA',rate:options.rate||3,min:100,max:10000,type:'Default',refill:true,no_drop:true}]);
   assert.equal(action,'add');orderCalls++;
   if(options.supplierTimeout)throw Error('simulated supplier timeout');
   return Response.json({order:'test-only'});
  };
  t.after(()=>{globalThis.fetch=originalFetch;globalThis.__litixTestDatabase=originalDatabase;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}});
  const {POST}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+label).toString('base64'));
  const request=new Request('https://example.test/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({serviceId:'1',quantity:1000,email:'test@example.test',link:'https://example.test/post',paymentToken:'test-token-only',idempotencyKey:'12345678-1234-1234-1234-123456789abc',expectedAmountCents:750,...options})});
  const response=await POST(request);
  assert.equal(response.status,status);
  assert.equal(paymentCalls,payments);assert.equal(orderCalls,orders);
  if(label.startsWith('price'))assert.equal(dbCalls,0,'price mismatch must not create an order');
  if(label==='uncertain payment'||label==='approved without transaction ID')assert.equal((await response.json()).payment,'review');
 });
}
test('server checkout and catalog importer use the same 2.5x markup',()=>{
 const route=readFileSync(new URL('../app/api/[action]/route.js',import.meta.url),'utf8');
 const bulk=readFileSync(new URL('../app/api/v2/bulk-import/route.js',import.meta.url),'utf8');
 assert.match(route,/rate\)\*2\.5\*qty/);
 assert.match(bulk,/baseRate \* 2\.5/);
 assert.doesNotMatch(route,/SMMFOLLOWOM/);
 assert.doesNotMatch(bulk,/SMMFOLLOWOM/);
});
test('browser submits the displayed total for server confirmation',()=>{
 const page=readFileSync(new URL('../app/page.jsx',import.meta.url),'utf8');
 assert.match(page,/expectedAmountCents:price/);
 assert.match(page,/price<500/);
 assert.match(page,/Minimum order \$5\.00/);
});
