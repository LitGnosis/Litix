const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {hostedResponse,directResponse,evidence,encryptRaw,installCheckout}=require('../lib/checkout');
const good='<response><result>1</result><result-code>100</result-code><transaction-id>123456</transaction-id><form-url>https://secure.nmi.com/api/v2/three-step/example</form-url></response>';
test('accepts real XML shape without JSON conversion',()=>assert.equal(hostedResponse(good).transactionId,'123456'));
for(const [name,xml] of [
 ['decline',good.replace('100','200')],['missing code',good.replace('<result-code>100</result-code>','')],
 ['duplicate code',good.replace('</response>','<result-code>100</result-code></response>')],
 ['untrusted host',good.replace('secure.nmi.com','secure.nmi.com.attacker.test')],
 ['credentials',good.replace('https://secure','https://user:password@secure')],
 ['malformed',good.slice(0,-8)],['DTD','<!DOCTYPE response>'+good],['JSON','{"response":1}']
])test('rejects '+name,()=>assert.throws(()=>hostedResponse(xml)));
test('Direct Post requires approval code and transaction reference',()=>{
 assert.equal(directResponse('response=1&response_code=100&transactionid=123456').transactionId,'123456');
 for(const s of ['response=2&response_code=200&transactionid=123456','response=1&response_code=100','response=1&response=2&response_code=100&transactionid=123456','<html>error</html>'])assert.throws(()=>directResponse(s));
});
test('HMAC has no fallback key and tamper changes signature',()=>{
 assert.throws(()=>evidence({},''));const a=evidence({amount:'1.00'},'a'.repeat(32)),b=evidence({amount:'2.00'},'a'.repeat(32));assert.notEqual(a.signature,b.signature);
});
test('diagnostics encrypt exact raw text',()=>{
 const secret='a'.repeat(32),raw='<response>private payload</response>',out=JSON.parse(encryptRaw(raw,secret));
 const d=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(secret).digest(),Buffer.from(out.iv,'base64'));d.setAuthTag(Buffer.from(out.tag,'base64'));
 assert.equal(Buffer.concat([d.update(Buffer.from(out.data,'base64')),d.final()]).toString(),raw);
});
test('committed claim blocks concurrent requests and caches successful response',async()=>{
 process.env.LITIX_AUDIT_SIGNING_SECRET='a'.repeat(32);process.env.LITIX_AUDIT_KEY_ID='test';process.env.LITIX_NMI_CHECKOUT_PATH='redirect';
 let handler,claim,dispatches=0,audits=0,finish;
 const waiting=new Promise(r=>finish=r);
 const client={release(){},async query(sql,args){
  if(sql.startsWith('SELECT id,'))return {rows:[{retail_cents:999,customer_email:'customer@example.test',payment_status:'pending',payment_provider:'paykings'}]};
  if(sql.startsWith('INSERT INTO litix_nmi_idempotency_store')){if(claim)return {rowCount:0};claim={request_hash:args[1],state:'pending'};return {rowCount:1};}
  if(sql.startsWith('SELECT request_hash'))return {rows:[claim]};
  if(sql.startsWith('INSERT INTO litix_paykings_checkout_orders'))return {rowCount:1};
  if(sql.startsWith('INSERT INTO litix_nmi_provider_operations_audit'))audits++;
  if(sql.includes("SET state='succeeded'")){claim.state='succeeded';claim.response_cache=JSON.parse(args[1]);}
  return {rows:[],rowCount:1};
 }};
 installCheckout({post(_path,_middleware,h){handler=h;}},{json(){return ()=>{};}},{db:()=>({connect:async()=>client}),authorized:()=>true,active:()=>true,testMode:async()=>false,xml:()=>'<sale/>',signed:()=> 'state',baseUrl:()=> 'https://secure.nmi.com'});
 const original=global.fetch;global.fetch=async()=>{dispatches++;await waiting;return {ok:true,text:async()=>good};};
 const req={body:{orderId:'ltx_123456789012345678901234'}},response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(value){this.value=value;return this;}});
 try{
  const a=response(),b=response();const first=handler(req,a);
  while(!dispatches)await new Promise(r=>setImmediate(r));
  await handler(req,b);assert.equal(b.statusCode,409);assert.equal(dispatches,1);
  finish();await first;assert.equal(a.statusCode,200);assert.equal(audits,1);
  const replay=response();await handler(req,replay);assert.deepEqual(replay.value,a.value);assert.equal(dispatches,1);
 }finally{finish();global.fetch=original;}
});
