import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Import the actual route with only its database transport replaced. All fetches
// are intercepted; these tests cannot charge a card or submit a supplier order.
const source=readFileSync(new URL('../app/api/[action]/route.js',import.meta.url),'utf8')
 .replace('import { after } from "next/server";', 'const after=()=>{};').replace('import { sendOrderEmails, notificationsConfigured } from "../../../lib/orderNotifications.mjs";', 'const sendOrderEmails=async()=>true;const notificationsConfigured=()=>false;')
 .replace('"../../../lib/pricing.mjs"', JSON.stringify(new URL('../lib/pricing.mjs',import.meta.url).href)).replace('"../../../lib/catalogSort.mjs"', JSON.stringify(new URL('../lib/catalogSort.mjs',import.meta.url).href)).replace('import { neon } from "@neondatabase/serverless";', 'const neon=()=>globalThis.__litixTestDatabase;');
const refillSiblings=['30 day','60 day','90 day','lifetime'].map((duration,i)=>({service:100+i,name:'Instagram followers '+duration+' refill',refill:true,rate:1,min:100,max:10000,type:'Default'}));
const cases=[
 ['cached catalog cannot authorize changed wholesale',{warmCatalog:true,changedWholesale:2},409,0,0],
 ['cached catalog cannot authorize unavailable supplier',{warmCatalog:true,failWholesale:true},503,0,0],
 ['quantity crosses wholesale bracket',{quantity:500,expectedAmountCents:250},422,0,0],
 ['unknown refill cannot be sold',{supplierName:'Instagram followers refill'},422,0,0],
 ['standard cap cannot fit wholesale',{supplierName:'TikTok Views',supplierRefill:false,supplierRate:3.01},422,0,0],
 ['unverified lifetime cannot bypass cap',{supplierName:'Instagram followers lifetime',supplierRefill:false},422,0,0],

 ...refillSiblings.map((service,i)=>['refill tier '+service.name,{serviceId:String(service.service),supplierName:service.name,siblings:refillSiblings,expectedAmountCents:[899,1049,1199,2299][i],expectedGatewayAmount:['8.99','10.49','11.99','22.99'][i]},200,1,1]),
 ['reject old halved total',{supplierRate:20,expectedAmountCents:5000},409,0,0],
 ['33677 wholesale floor supersedes old profit', {serviceId:'33677',supplierRate:3.706,expectedAmountCents:1853,expectedGatewayAmount:'18.53'}, 200, 1, 1],
 ['33516 wholesale plus 5', {serviceId:'33516',supplierRate:0.004,expectedAmountCents:501,expectedGatewayAmount:'5.01'}, 200, 1, 1],
 ['33337 wholesale plus 7.50', {serviceId:'33337',supplierRate:0.226,expectedAmountCents:773,expectedGatewayAmount:'7.73'}, 200, 1, 1],
 ['33338 wholesale plus 7.50', {serviceId:'33338',supplierRate:0.274,expectedAmountCents:778,expectedGatewayAmount:'7.78'}, 200, 1, 1],
 ['wholesale 40 requires exactly 2x', {serviceId:'33677',supplierRate:40,expectedAmountCents:8000,expectedGatewayAmount:'80.00'}, 200, 1, 1],
 ['override rejects previous price', {serviceId:'33677',supplierRate:3.706,expectedAmountCents:1371}, 409, 0, 0],
 ['retail exactly 30 unchanged', {supplierRate:6,expectedAmountCents:3000,expectedGatewayAmount:'30.00'}, 200, 1, 1],
 ['wholesale 6.01 requires 5x', {supplierRate:6.01,expectedAmountCents:3005,expectedGatewayAmount:'30.05'}, 200, 1, 1],
 ['wholesale 20 requires exactly 2x', {supplierRate:20,expectedAmountCents:4000,expectedGatewayAmount:'40.00'}, 200, 1, 1],
 ['TikTok likes high rate restored', {supplierName:'TikTok Likes',supplierRate:4,expectedAmountCents:2340,expectedGatewayAmount:'23.40'}, 200, 1, 1],
 ['reject stale undiscounted price', {supplierRate:20,expectedAmountCents:10000}, 409, 0, 0],
 ['TikTok likes approved', {supplierName:'TikTok Likes',expectedAmountCents:900}, 200, 1, 1],
 ['TikTok likes rejects old multiplier', {supplierName:'TikTok Likes',expectedAmountCents:500}, 409, 0, 0],
 ['TikTok views no-refill ladder', {supplierName:'TikTok Views',supplierRefill:false,expectedAmountCents:699,expectedGatewayAmount:'6.99'}, 200, 1, 1],
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
  let paymentCalls=0,orderCalls=0,dbCalls=0,catalogCalls=0; const updates=[];
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
   if(action==='services'){catalogCalls++;if(catalogCalls>1&&options.failWholesale)throw Error('mock wholesale unavailable');return Response.json(options.siblings||[{service:options.serviceId||1,name:options.supplierName||'USA No Drop Test service',refill:options.supplierRefill??true,rate:catalogCalls>1&&options.changedWholesale?options.changedWholesale:options.supplierRate??1,min:100,max:10000,type:'Default'}]);}
   assert.equal(action,'add');orderCalls++;
   if(options.supplierTimeout)throw Error('simulated supplier timeout');
   if(options.supplierReject)return Response.json({error:'Supplier rejected order'});
   return Response.json({order:'test-only'});
  };
  t.after(()=>{globalThis.fetch=originalFetch;globalThis.__litixTestDatabase=originalDatabase;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}});
  const {POST,GET}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+label).toString('base64'));
  if(options.warmCatalog)assert.equal((await GET(new Request('https://example.test/api/smmservices'))).status,200);
  if(options.serviceId&&!options.siblings){
   const catalog=await (await GET(new Request('https://example.test/api/smmservices'))).json();
   assert.equal(catalog.items[0].per1000,({'33677':options.supplierRate===40?80:18.53,'33516':5.01,'33337':7.73,'33338':7.78}[options.serviceId]));
  }
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
