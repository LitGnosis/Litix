'use strict';
const crypto = require('node:crypto');
const {XMLParser, XMLValidator} = require('fast-xml-parser');
const parser = new XMLParser({parseTagValue:false, ignoreAttributes:true, processEntities:false});
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function hostedResponse(raw) {
 if (raw.length > 100000 || /<!DOCTYPE|<!ENTITY/i.test(raw) || XMLValidator.validate(raw)!==true) throw Error('NMI_INVALID_XML');
 const parsed=parser.parse(raw), r=parsed.response;
 if(Object.keys(parsed).some(k=>!['response','?xml'].includes(k)) || !r || Array.isArray(r)) throw Error('NMI_INVALID_XML');
 if(r['result-code']!=='100'||r.result!=='1') throw Error('NMI_REQUEST_REJECTED');
 if(typeof r['form-url']!=='string') throw Error('NMI_INVALID_FORM_URL');
 const url=new URL(r['form-url'].replace(/&amp;/g,'&'));
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['secure.nmi.com','sandbox.nmi.com','secure.networkmerchants.com'].includes(url.hostname)) throw Error('NMI_INVALID_FORM_URL');
 if(!/^\d{4,40}$/.test(r['transaction-id']||'')) throw Error('NMI_MISSING_TRANSACTION');
 return {url:url.href,transactionId:r['transaction-id']};
}
function directResponse(raw) {
 if(raw.length>100000||raw.includes('<'))throw Error('NMI_INVALID_DIRECT_RESPONSE');
 const p=new URLSearchParams(raw);
 for(const k of ['response','response_code','transactionid'])if(p.getAll(k).length!==1)throw Error('NMI_INVALID_DIRECT_RESPONSE');
 if(p.get('response')!=='1'||p.get('response_code')!=='100'||!/^\d{4,40}$/.test(p.get('transactionid')))throw Error('NMI_AUTH_REJECTED');
 return {transactionId:p.get('transactionid')};
}
function evidence(fields, secret) {
 if(!secret || Buffer.byteLength(secret)<32)throw Error('AUDIT_KEY_REQUIRED');
 const manifest=JSON.stringify(fields);
 return {manifest,signature:crypto.createHmac('sha256',secret).update(manifest).digest('hex')};
}
function encryptRaw(raw,secret){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(secret).digest(),iv);
 const data=Buffer.concat([cipher.update(raw,'utf8'),cipher.final()]);
 return JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
}
function installCheckout(app, express, deps){
 const {db,authorized,active,testMode,xml,signed,baseUrl}=deps;
 app.post('/api/payments/paykings/create-checkout',express.json({limit:'8kb'}),async(req,res)=>{
  if(!authorized(req))return res.status(401).json({code:'UNAUTHORIZED'});
  if(!active())return res.status(503).json({code:'PAYMENTS_DISABLED'});
  const orderId=String(req.body?.orderId||''),path=process.env.LITIX_NMI_CHECKOUT_PATH||'redirect';
  const token=req.body?.payment_token;
  if(!/^ltx_[a-z0-9-]{20,80}$/i.test(orderId))return res.status(400).json({code:'INVALID_ORDER'});
  if(!['redirect','collect'].includes(path))return res.status(503).json({code:'CHECKOUT_CONFIGURATION_INVALID'});
  if(path==='collect'&&(process.env.LITIX_NMI_TOKENIZATION_VERIFIED!=='true'||typeof token!=='string'||token.length<10||token.length>2048))return res.status(409).json({code:'TOKENIZATION_NOT_READY'});
  const secret=process.env.LITIX_AUDIT_SIGNING_SECRET,keyId=process.env.LITIX_AUDIT_KEY_ID;
  if(!secret||Buffer.byteLength(secret)<32||!keyId)return res.status(503).json({code:'AUDIT_CONFIGURATION_REQUIRED'});
  let client,claimed=false,raw='',requestHash;
  try{
   if(await testMode())return res.status(409).json({code:'NMI_TEST_MODE_ON'});
   client=await db().connect();
   await client.query('BEGIN');
   const q=await client.query('SELECT id,customer_id,customer_email,retail_cents,payment_status,payment_provider FROM litix_supplier_orders WHERE id=$1 FOR UPDATE',[orderId]),o=q.rows[0];
   if(!o||o.payment_status!=='pending'||o.payment_provider!=='paykings'||!o.customer_email||!Number.isSafeInteger(Number(o.retail_cents))||Number(o.retail_cents)<1){await client.query('ROLLBACK');return res.status(409).json({code:'ORDER_NOT_READY'});}
   const amount=(Number(o.retail_cents)/100).toFixed(2);
   requestHash=hash(JSON.stringify({orderId,path,amount,currency:'USD',tokenHash:token?hash(token):null}));
   const inserted=await client.query("INSERT INTO litix_nmi_idempotency_store(order_id,request_hash,state) VALUES($1,$2,'pending') ON CONFLICT DO NOTHING RETURNING order_id",[orderId,requestHash]);
   if(!inserted.rowCount){
    const prior=(await client.query('SELECT request_hash,state,response_cache FROM litix_nmi_idempotency_store WHERE order_id=$1',[orderId])).rows[0];
    await client.query('ROLLBACK');
    if(prior.request_hash!==requestHash)return res.status(409).json({code:'IDEMPOTENCY_CONFLICT'});
    if(prior.state==='succeeded')return res.json(prior.response_cache);
    return res.status(409).json({code:'CHECKOUT_REQUIRES_RECONCILIATION'});
   }
   const customer=o.customer_id||'guest_'+hash(o.customer_email).slice(0,22);
   const checkout=await client.query("INSERT INTO litix_paykings_checkout_orders(order_id,customer_id,amount_cents,currency,billing_email,payment_state) VALUES($1,$2,$3,'USD',$4,'initiating') ON CONFLICT DO NOTHING RETURNING order_id",[orderId,customer,o.retail_cents,o.customer_email]);
   if(!checkout.rowCount){await client.query('ROLLBACK');return res.status(409).json({code:'CHECKOUT_ALREADY_STARTED'});}
   await client.query('COMMIT');claimed=true;
   let body,url,contentType;
   if(path==='redirect'){
    const redirect=new URL('/api/payments/paykings/complete',process.env.LITIX_PAYKINGS_PUBLIC_URL||'https://litix-paykings-webhook.vercel.app');
    redirect.searchParams.set('order_id',orderId);redirect.searchParams.set('state',signed(orderId));
    const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    body=xml('sale','<redirect-url>'+esc(redirect.href)+'</redirect-url><amount>'+amount+'</amount><currency>USD</currency><order-id>'+esc(orderId)+'</order-id><billing><email>'+esc(o.customer_email)+'</email></billing>');
    url=baseUrl()+'/api/v2/three-step';contentType='text/xml';
   }else{
    body=new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,type:'auth',payment_token:token,amount,currency:'USD',orderid:orderId,email:o.customer_email}).toString();
    url=baseUrl()+'/api/transact.php';contentType='application/x-www-form-urlencoded';
   }
   const response=await fetch(url,{method:'POST',headers:{'content-type':contentType},body,redirect:'error',signal:AbortSignal.timeout(12000)});
   raw=await response.text();
   if(!response.ok)throw Error('NMI_TRANSPORT_ERROR');
   const result=path==='redirect'?hostedResponse(raw):directResponse(raw);
   const payload=path==='redirect'?{provider:'paykings',reference:orderId,url:result.url}:{provider:'paykings',reference:orderId,status:'AUTHORIZED',transactionId:result.transactionId};
   // Step 1 and auth are NOT settlement; only existing Query API reconciliation marks paid.
   const proof=evidence({version:1,keyId,requestHash,transactionId:result.transactionId,amount,currency:'USD',status:path==='redirect'?'INITIALIZED':'AUTHORIZED',executedAt:new Date().toISOString()},secret);
   await client.query('BEGIN');
   await client.query("INSERT INTO litix_nmi_provider_operations_audit(order_id,request_hash,state,transaction_id,manifest,signature,key_id) VALUES($1,$2,'succeeded',$3,$4,$5,$6)",[orderId,requestHash,result.transactionId,proof.manifest,proof.signature,keyId]);
   await client.query("UPDATE litix_nmi_idempotency_store SET state='succeeded',response_cache=$2::jsonb WHERE order_id=$1",[orderId,JSON.stringify(payload)]);
   await client.query("UPDATE litix_paykings_checkout_orders SET payment_state=$2,gateway_transaction_id=$3 WHERE order_id=$1",[orderId,path==='redirect'?'pending':'authorized',result.transactionId]);
   await client.query('COMMIT');return res.json(payload);
  }catch(error){
   if(client)await client.query('ROLLBACK').catch(()=>{});
   if(claimed)try{
    await client.query('BEGIN');
    await client.query("INSERT INTO litix_nmi_provider_operations_audit(order_id,request_hash,state,encrypted_response,key_id) VALUES($1,$2,'unknown',$3,$4)",[orderId,requestHash,encryptRaw(raw.slice(0,100000),secret),keyId]);
    await client.query("UPDATE litix_nmi_idempotency_store SET state='unknown' WHERE order_id=$1",[orderId]);
    await client.query('COMMIT');
   }catch{await client.query('ROLLBACK').catch(()=>{});}
   console.error('nmi_checkout_failed',{orderId,claimed});
   return res.status(503).json({code:claimed?'CHECKOUT_REQUIRES_RECONCILIATION':'CHECKOUT_UNAVAILABLE'});
  }finally{client?.release();}
 });
}
module.exports={installCheckout,hostedResponse,directResponse,evidence,encryptRaw};
