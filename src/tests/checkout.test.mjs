import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Import the actual route with only its database transport replaced. All fetches
// are intercepted; these tests cannot charge a card or submit a supplier order.
const source=readFileSync(new URL('../app/api/[action]/route.js',import.meta.url),'utf8')
 .replace('import { neon } from "@neondatabase/serverless";', 'const neon=()=>globalThis.__litixTestDatabase;');
const cases=[
 ['retail exactly 30 unchanged', {supplierRate:6,expectedAmountCents:3000,expectedGatewayAmount:'30.00'}, 200, 1, 1],
 ['retail above 30 halved', {supplierRate:6.01,expectedAmountCents:1503,expectedGatewayAmount:'15.03'}, 200, 1, 1],
 ['retail 100 halved only once', {supplierRate:20,expectedAmountCents:5000,expectedGatewayAmount:'50.00'}, 200, 1, 1],
 ['TikTok likes high rate halved', {supplierName:'TikTok Likes',supplierRate:4,expectedAmountCents:1800,expectedGatewayAmount:'18.00'}, 200, 1, 1],
 ['reject stale undiscounted price', {supplierRate:20,expectedAmountCents:10000}, 409, 0, 0],
 ['TikTok likes approved', {supplierName:'TikTok Likes',expectedAmountCents:900}, 200, 1, 1],
 ['TikTok likes rejects old multiplier', {supplierName:'TikTok Likes',expectedAmountCents:500}, 409, 0, 0],
 ['TikTok views retains 5x', {supplierName:'TikTok Views'}, 200, 1, 1],
 ['Instagram likes retains 5x', {supplierName:'Instagram Likes'}, 200, 1, 1],
 ['price changed', {expectedAmountCents:799}, 409, 0, 0],
 ['price omitted', {expectedAmountCents:undefined}, 409, 0, 0],
 ['approved', {}, 200, 1, 1],
 ['approved without transaction ID', {gateway:'missing-transaction'}, 202, 1, 0],
 ['declined', {gateway:'declined'}, 402, 1, 0],
 ['uncertain payment', {gateway:'timeout'}, 202, 1, 0],
 ['duplicate checkout', {duplicate:true}, 409, 0, 0],
 ['supplier rejects dispatch', {supplierReject:true}, 202, 1, 1],
 ['supplier result persistence fails', {supplierPersistFail:true}, 202, 1, 1],
 ['paid persistence fails', {paidPersistFail:true}, 202, 1, 0],
 ['supplier timeout after payment', {supplierTimeout:true}, 202, 1, 1],
];
for(const [label,options,status,payments,orders] of cases){
 test(label,async t=>{
  const originalFetch=globalThis.fetch;
  const originalDatabase=globalThis.__litixTestDatabase;
  const keys=['DATABASE_URL','SMMGLOB_API_KEY','NMI_SECURITY_KEY','PAYKINGS_NMI_COLLECT_PUBLIC_KEY'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  keys.forEach(k=>process.env[k]='test-only');
  let paymentCalls=0,orderCalls=0,dbCalls=0; const updates=[];
  globalThis.__litixTestDatabase={query:async sql=>{dbCalls++;updates.push(sql);if(options.paidPersistFail&&sql.includes("payment_state='paid'"))throw Error('database unavailable');if(options.supplierPersistFail&&sql.includes('set supplier_order_id='))throw Error('database unavailable');return sql.startsWith('insert')?(options.duplicate?[]:[{id:'test-order'}]):[];}};
  globalThis.fetch=async(url,init)=>{
   if(String(url)==='https://paykings.transactiongateway.com/api/transact.php'){
    assert.equal(init.body.get('amount'),options.expectedGatewayAmount||(options.supplierName==='TikTok Likes'?'9.00':'5.00'));
    paymentCalls++;
    if(options.gateway==='timeout')throw Error('simulated timeout');
    return new Response(options.gateway==='declined'?'response=2&responsetext=Declined':options.gateway==='missing-transaction'?'response=1&responsetext=Approved':'response=1&transactionid=test-only');
   }
   assert.equal(String(url),'https://smmglob.com/api/v2');
   const action=init.body.get('action');
   if(action==='services')return Response.json([{service:1,name:options.supplierName||'USA No Drop Test service',refill:true,rate:options.supplierRate??1,min:100,max:10000,type:'Default'}]);
   assert.equal(action,'add');orderCalls++;
   if(options.supplierTimeout)throw Error('simulated supplier timeout');
   if(options.supplierReject)return Response.json({error:'Supplier rejected order'});
   return Response.json({order:'test-only'});
  };
  t.after(()=>{globalThis.fetch=originalFetch;globalThis.__litixTestDatabase=originalDatabase;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}});
  const {POST}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+label).toString('base64'));
  const request=new Request('https://example.test/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({serviceId:'1',quantity:1000,email:'test@example.test',link:'https://example.test/post',paymentToken:'test-token-only',idempotencyKey:'12345678-1234-1234-1234-123456789abc',expectedAmountCents:500,...options})});
  const response=await POST(request);
  assert.equal(response.status,status);
  assert.equal(paymentCalls,payments);assert.equal(orderCalls,orders);
  if(options.supplierTimeout||options.supplierReject||options.supplierPersistFail){const body=await response.json();assert.equal(body.payment,'paid');assert.ok(updates.some(q=>q.includes("payment_state='paid'")));assert.ok(updates.some(q=>q.includes("fulfillment_state='manual_review'")));assert.ok(!updates.some(q=>q.includes("payment_state='review'")));}
  if(label.startsWith('price'))assert.equal(dbCalls,0,'price mismatch must not create an order');
  if(label==='uncertain payment'||label==='approved without transaction ID')assert.equal((await response.json()).payment,'review');
 });
}
test('browser submits the displayed total for server confirmation',()=>{
 const page=readFileSync(new URL('../app/page.jsx',import.meta.url),'utf8');
 assert.match(page,/expectedAmountCents:price/);
});
