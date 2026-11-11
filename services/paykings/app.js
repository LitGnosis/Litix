'use strict';
/*
 Litix PayKings / NMI receiver.
 - NMI webhooks are signed HMAC-SHA256 with Webhook-Signature: t=nonce,s=digest.
 - A matching server-to-server Query API result is required for reconciliation.
 - Optional checkout initialization / authorization; no automatic wallet credits or supplier fulfillment.
 - Sensitive gateway keys must be installed in Vercel, never sent to browser.
 */
const express=require('express');
const {Pool}=require('pg');
const {XMLParser}=require('fast-xml-parser');
const {normalize,verifySignature,cents}=require('./lib/paykings-utils');
const app=express();app.disable('x-powered-by');
const required=['NMI_SECURITY_KEY','NMI_WEBHOOK_SIGNING_KEY','DATABASE_URL'];
const ready=()=>process.env.LITIX_PAYKINGS_ENABLED==='true'&&required.every(k=>Boolean(process.env[k]));
const mode=()=>process.env.NMI_MODE==='sandbox'?'sandbox':'production';
let pool;const db=()=>pool||(pool=new Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:6000,ssl:{rejectUnauthorized:true}}));
const parser=new XMLParser({ignoreAttributes:true,parseTagValue:false,trimValues:true,processEntities:false});
const noCache=(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();};
app.use(noCache);
app.get('/',(_req,res)=>res.status(200).json({service:'Litix PayKings webhook',status:'deployed',paymentsActive:ready()}));
app.get('/api/payments/paykings/status',(_req,res)=>res.status(200).json({
 service:'paykings',receiver:'deployed',paymentsActive:ready(),gatewayMode:mode(),
 dbConfigured:Boolean(process.env.DATABASE_URL),
 gatewayApiKeyConfigured:Boolean(process.env.NMI_SECURITY_KEY),
 webhookSigningKeyConfigured:Boolean(process.env.NMI_WEBHOOK_SIGNING_KEY),
 customerChargesEnabled:false,automaticWalletCreditsEnabled:false
}));
async function lookup(id){
 const form=new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,transaction_id:id});
 const url=mode()==='sandbox'?'https://sandbox.nmi.com/api/query.php':'https://secure.nmi.com/api/query.php';
 const r=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error('Gateway query rejected');
 const xml=await r.text();if(xml.length>150000)throw new Error('Oversized gateway response');
 const root=parser.parse(xml)?.nm_response;
 if(!root||root.error||!root.transaction)throw new Error('Missing query transaction');
 const tx=Array.isArray(root.transaction)?root.transaction:[root.transaction];
 if(tx.length!==1)throw new Error('Ambiguous transaction');return tx[0];
}
function approvedAmount(tx){
 const actions=[tx.action||[]].flat();
 const rejected=actions.some(a=>String(a.success)==='1'&&['refund','credit','void','return'].includes(a.action_type));
 if(rejected)return null;
 const positive=actions.filter(a=>String(a.success)==='1'&&['sale','capture'].includes(a.action_type));
 if(positive.length!==1)return null;
 return cents(String(positive[0].amount));
}
async function reconcile(ev,tx,n){
 const c=await db().connect();
 try{
  await c.query('BEGIN');
  const ins=await c.query(
   'INSERT INTO litix_paykings_gateway_events(event_id,event_type,transaction_id,order_id,state,response_code,billing_email) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_id) DO NOTHING RETURNING event_id',
   [ev.event_id,ev.event_type,n.transactionId,n.orderId,'received',n.responseCode,n.billingEmail]);
  if(!ins.rowCount){await c.query('COMMIT');return 'duplicate';}
  const {rows}=await c.query(
   'SELECT order_id,customer_id,amount_cents,currency,billing_email,payment_state,gateway_transaction_id FROM litix_paykings_checkout_orders WHERE order_id=$1 FOR UPDATE',
   [n.orderId]);
  const order=rows[0],amt=approvedAmount(tx),email=String(tx.email||'').trim().toLowerCase();
  const valid=order&&['transaction.sale.success','transaction.capture.success'].includes(ev.event_type)
    &&amt!==null&&String(tx.transaction_id)===n.transactionId&&String(tx.order_id)===n.orderId
    &&String(tx.currency||'').toUpperCase()===String(order.currency).toUpperCase()
    &&amt===Number(order.amount_cents)&&email===String(order.billing_email).toLowerCase()
    &&(!n.billingEmail||n.billingEmail===email)
    &&(!order.gateway_transaction_id||order.gateway_transaction_id===n.transactionId)
    &&!['refunded','chargeback','canceled'].includes(order.payment_state)
    &&(mode()==='sandbox'||ev.event_body?.features?.is_test_mode!==true);
  let state='manual_review';
  if(valid&&String(tx.condition)!=='complete')state='awaiting_settlement';
  else if(valid){
   const out=await c.query(
    'INSERT INTO litix_paykings_outbox(transaction_id,order_id,customer_id,amount_cents,event_type) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING transaction_id',
    [n.transactionId,order.order_id,order.customer_id,order.amount_cents,ev.event_type]);
   if(out.rowCount){
    await c.query("UPDATE litix_paykings_checkout_orders SET payment_state='settled',gateway_transaction_id=$2,settled_at=now() WHERE order_id=$1",[order.order_id,n.transactionId]);
    state='queued_for_review';
   }else state='duplicate_payment';
  }
  await c.query('UPDATE litix_paykings_gateway_events SET state=$2 WHERE event_id=$1',[ev.event_id,state]);
  await c.query('COMMIT');return state;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
app.post('/api/payments/paykings/webhook',express.raw({type:'application/json',limit:'64kb'}),async(req,res)=>{
 if(!ready())return res.status(503).json({error:'Gateway not activated'});
 if(!verifySignature(req.body,req.get('Webhook-Signature'),process.env.NMI_WEBHOOK_SIGNING_KEY))
  return res.status(401).json({error:'Invalid signature'});
 let ev;try{ev=JSON.parse(req.body.toString('utf8'));}catch{return res.status(400).json({error:'Invalid payload'});}
 const n=normalize(ev);
 if(!/^[A-Za-z0-9-]{8,80}$/.test(String(ev.event_id||''))||!/^\d{4,40}$/.test(n.transactionId)
  ||!/^[A-Za-z0-9_-]{1,100}$/.test(n.orderId)||typeof ev.event_type!=='string')
  return res.status(400).json({error:'Invalid event identifiers'});
 const expectedMerchant=process.env.NMI_MERCHANT_ID;
 if(expectedMerchant&&String(ev.event_body?.merchant?.id)!==expectedMerchant)
  return res.status(403).json({error:'Merchant mismatch'});
 if(!['transaction.sale.success','transaction.capture.success'].includes(ev.event_type)){
  // Other event types can require refund/chargeback handling by a separate
  // settlement worker. Never credit wallets from unsolicited event types.
  return res.status(202).json({accepted:true,state:'ignored_nonsettlement_event'});
 }
 try{return res.status(202).json({accepted:true,state:await reconcile(ev,await lookup(n.transactionId),n)});}
 catch(e){console.error('Gateway reconciliation failed:',e.name);return res.status(503).json({error:'Temporary verification failure'});}
});
app.use((err,_req,res,_next)=>{console.error('Receiver error:',err.name);res.status(500).json({error:'Internal receiver error'});});
module.exports=app;

// LITIX_PAYKINGS_HOSTED_BRIDGE_V1
const pkCrypto=require('node:crypto');
function pkEq(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length>0&&aa.length===bb.length&&pkCrypto.timingSafeEqual(aa,bb);}
function pkEsc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
const pkKey=()=>String(process.env.LITIX_PAYKINGS_BRIDGE_SECRET||'');
const pkActive=()=>process.env.LITIX_PAYKINGS_CHARGES_ACTIVE==='true'&&!!pkKey()&&process.env.LITIX_PAYKINGS_ENABLED==='true';
const pkModeUrl=()=>process.env.NMI_MODE==='sandbox'?'https://sandbox.nmi.com':'https://secure.nmi.com';
async function pkQuery(params){
 const r=await fetch(pkModeUrl()+'/api/query.php',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,...params}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new Error('Gateway query HTTP '+r.status);
 const s=await r.text();if(s.length>160000)throw new Error('Gateway response too large');
 const x=parser.parse(s)?.nm_response;if(!x||x.error)throw new Error('Gateway query failed');
 return x;
}
async function pkTestMode(){
 const x=await pkQuery({report_type:'test_mode_status'});
 const v=x.test_mode_enabled??x.account_details?.test_mode_enabled??x.test_mode_status?.test_mode_enabled;
 const s=String(v??'').toLowerCase();if(!['true','false','0','1'].includes(s))throw new Error('Test-mode state unverified');
 return s==='true'||s==='1';
}
async function pkThreeStep(xml){
 const r=await fetch(pkModeUrl()+'/api/v2/three-step',{method:'POST',headers:{'content-type':'text/xml'},body:xml,signal:AbortSignal.timeout(12000)});
 const body=await r.text();if(!r.ok||body.length>100000)throw new Error('Hosted gateway unavailable');
 const x=parser.parse(body);return x;
}
function pkXml(action,body){return '<?xml version="1.0" encoding="UTF-8"?><'+action+'><api-key>'+pkEsc(process.env.NMI_SECURITY_KEY)+'</api-key>'+body+'</'+action+'>';}
function pkSigned(orderId){return pkCrypto.createHmac('sha256',pkKey()).update(orderId).digest('hex');}
function pkAuthorized(req){if(!pkKey())return false;const h=String(req.get('authorization')||'');return pkEq(h,'Bearer '+pkKey());}
function pkMoney(v){const s=String(v||'');if(!/^(0|[1-9][0-9]{0,7})[.][0-9]{2}$/.test(s))return null;return Math.round(Number(s)*100);}
async function pkVerifiedSale(orderId,txid){
 const x=await pkQuery({transaction_id:txid});const tx=Array.isArray(x.transaction)?x.transaction[0]:x.transaction;
 if(!tx||String(tx.transaction_id)!==txid||String(tx.order_id)!==orderId||String(tx.currency||'USD').toUpperCase()!=='USD')throw new Error('Gateway transaction mismatch');
 const actions=[tx.action||[]].flat();if(actions.some(a=>a.success==='1'&&['refund','credit','void','return'].includes(a.action_type)))throw new Error('Payment reversed');
 const sales=actions.filter(a=>String(a.success)==='1'&&['sale','capture'].includes(a.action_type));
 if(sales.length!==1)throw new Error('Unverified sale action');
 const amount=pkMoney(sales[0].amount);if(amount===null)throw new Error('Invalid gateway amount');
 return {tx,amount,condition:String(tx.condition||''),email:String(tx.email||'').trim().toLowerCase()};
}
async function pkRecordVerified(orderId,txid){
 if(await pkTestMode())throw new Error('Account Test Mode remains enabled');
 const verified=await pkVerifiedSale(orderId,txid);
 const client=await db().connect();
 try{
  await client.query('BEGIN');
  const result=await client.query('SELECT order_id,customer_id,amount_cents,billing_email,gateway_transaction_id,payment_state FROM litix_paykings_checkout_orders WHERE order_id=$1 FOR UPDATE',[orderId]);const row=result.rows[0];
  const source=await client.query('SELECT id,retail_cents,customer_email,payment_status FROM litix_supplier_orders WHERE id=$1 FOR UPDATE',[orderId]);const o=source.rows[0];
  if(!row||!o||Number(row.amount_cents)!==verified.amount||Number(o.retail_cents)!==verified.amount||row.billing_email.toLowerCase()!==verified.email||String(o.customer_email||'').toLowerCase()!==verified.email||(row.gateway_transaction_id&&row.gateway_transaction_id!==txid))throw new Error('Order amount or identity mismatch');
  if(verified.condition==='complete'){
   await client.query("UPDATE litix_paykings_checkout_orders SET payment_state='settled',gateway_transaction_id=$2,settled_at=now() WHERE order_id=$1",[orderId,txid]);
   await client.query("UPDATE litix_supplier_orders SET payment_status='paid',payment_provider='paykings',payment_reference=$2,updated_at=now() WHERE id=$1 AND payment_status IN ('pending','paid')",[orderId,txid]);
   await client.query("INSERT INTO litix_paykings_outbox(transaction_id,order_id,customer_id,amount_cents,event_type) VALUES($1,$2,$3,$4,'transaction.settled') ON CONFLICT DO NOTHING",[txid,orderId,row.customer_id,row.amount_cents]);
  }else{
   await client.query("UPDATE litix_paykings_checkout_orders SET payment_state='awaiting_settlement',gateway_transaction_id=$2 WHERE order_id=$1 AND payment_state<>'settled'",[orderId,txid]);
  }
  await client.query('COMMIT');return {settled:verified.condition==='complete'};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
app.get('/api/payments/paykings/checkout-readiness',async (_req,res)=>{
 if(!pkActive())return res.json({hostedCheckoutConfigured:!!pkKey(),customerChargesEnabled:false,ready:false});
 try{const test=await pkTestMode();return res.json({hostedCheckoutConfigured:true,customerChargesEnabled:!test,ready:!test,merchantTestMode:test})}
 catch{return res.status(503).json({hostedCheckoutConfigured:true,customerChargesEnabled:false,ready:false})}
});
require('./lib/checkout').installCheckout(app,express,{db,authorized:pkAuthorized,active:pkActive,testMode:pkTestMode,xml:pkXml,signed:pkSigned,baseUrl:pkModeUrl});
app.get('/api/payments/paykings/complete',async(req,res)=>{
 const id=String(req.query.order_id||''),sig=String(req.query.state||''),token=String(req.query['token-id']||'');
 if(!pkKey()||!/^ltx_[a-z0-9-]{20,80}$/i.test(id)||!pkEq(sig,pkSigned(id))||!token||token.length>256)return res.status(400).send('Invalid checkout return');
 try{
  const result=(await pkThreeStep(pkXml('complete-action','<token-id>'+pkEsc(token)+'</token-id>')))?.response||{};
  const txid=String(result['transaction-id']||'');
  if(String(result.result)!=='1'||String(result['result-code'])!=='100'||!new RegExp('^[0-9]{4,40}$').test(txid))throw new Error('Payment was not verified');
  const st=await pkRecordVerified(id,txid);
  res.redirect(303,'https://www.litix.net/?orderId='+encodeURIComponent(id)+'&payment='+(st.settled?'confirmed':'processing'));
 }catch(e){console.error('paykings_complete_failed',e?.message||e);res.status(503).send('Payment status is being verified. Contact Litix support with your order ID.')}
});
app.get('/api/payments/paykings/reconcile',async(req,res)=>{
 if(!pkAuthorized(req))return res.status(401).json({error:'Unauthorized'});
 if(!pkActive())return res.json({active:false,checked:0});
 let checked=0,settled=0;
 try{
 const q=await db().query("SELECT order_id,gateway_transaction_id FROM litix_paykings_checkout_orders WHERE payment_state IN ('awaiting_settlement','settled') AND gateway_transaction_id IS NOT NULL ORDER BY created_at LIMIT 5");
 for(const o of q.rows){checked++;try{const s=await pkRecordVerified(o.order_id,o.gateway_transaction_id);if(s.settled)settled++}catch(e){console.error('paykings_reconcile_check_failed',o.order_id,e?.message||e)}}
 return res.json({checked,settled});
 }catch{return res.status(503).json({error:'Settlement reconciliation temporarily unavailable'})}
});
