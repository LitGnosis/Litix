import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import pg from 'pg';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

if (process.env.LITIX_PR183_TEST_MODE !== 'true') throw new Error('Staging-only gate required');
const { Pool } = pg;
const required = ['DATABASE_URL', 'REDIS_URL', 'NMI_MERCHANT_WEBHOOK_SECRET', 'NMI_MERCHANT_ID', 'STAGING_WEBHOOK_URL'];
for (const key of required) if (!process.env[key]) throw new Error('Missing test variable: '+key);
const endpoint = new URL(process.env.STAGING_WEBHOOK_URL);
assert.equal(endpoint.protocol,'https:');
assert.ok(endpoint.hostname.endsWith('.up.railway.app'),'staging domain must be Railway');
assert.equal(endpoint.pathname,'/api/billing/paykings-fulfillment');
const pool = new Pool({ connectionString:process.env.DATABASE_URL, max:1, connectionTimeoutMillis:6000, application_name:'litix_pr183_qa_no_charge' });
const redis = new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
const queue = new Queue('litix-first-party-dispatch',{connection:redis});
const stamp = randomBytes(8).toString('hex');
const orderId = 'pr183_qa_order_'+stamp;
const transactionId = 'pr183_qa_txn_'+stamp;
const saleEventId = 'pr183_qa_sale_'+stamp;
const settleEventId = 'pr183_qa_settle_'+stamp;
const merchantId = process.env.NMI_MERCHANT_ID;
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
const webhook = async (payload) => {
  const raw = JSON.stringify(payload);
  const nonce=randomBytes(12).toString('hex');
  const digest=createHmac('sha256',process.env.NMI_MERCHANT_WEBHOOK_SECRET).update(nonce+'.'+raw).digest('hex');
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','webhook-signature':'t='+nonce+',s='+digest},body:raw,redirect:'error',signal:AbortSignal.timeout(18000)});
  const json=await response.json().catch(()=>({error:'non_json_response'}));
  return {status:response.status,state:json.state??json.error};
};
let finished=false;
try{
  await pool.query(
    `INSERT INTO growth_ops.litix_owned_payment_intents
     (order_id,provider,provider_transaction_id,expected_amount_cents,currency,live_mode,execution_approved,service_kind,payload,tenant_key,state)
     VALUES($1,'nmi',$2,100,'USD',true,true,'website_preview',$3::jsonb,'pr183_qa_tenant','pending')`,
    [orderId,transactionId,JSON.stringify({isSyntheticTest:true,kind:'website_preview',url:'https://www.litix.net/api/fulfillment/health'})]
  );
  const sale={event_id:saleEventId,event_type:'transaction.sale.success',event_body:{
    merchant:{id:merchantId},features:{is_test_mode:false},transaction_type:'cc',
    order_id:orderId,transaction_id:transactionId,currency:'USD',action:{success:'1',amount:'1.00'}
  }};
  const saleFirst=await webhook(sale);
  const saleReplay=await webhook(sale);
  assert.deepEqual([saleFirst.status,saleFirst.state],[200,'awaiting_settlement']);
  assert.deepEqual([saleReplay.status,saleReplay.state],[200,'duplicate']);
  const before=await pool.query(`SELECT
     (SELECT count(*)::integer FROM growth_ops.litix_verified_payment_events WHERE event_id IN($1,$2)) AS verified_events,
     (SELECT count(*)::integer FROM growth_ops.litix_payment_dispatch_outbox WHERE order_id=$3) AS outbox_entries,
     (SELECT count(*)::integer FROM public.master_node_jobs WHERE order_id=$3) AS jobs`,
     [saleEventId,settleEventId,orderId]);
  assert.deepEqual([before.rows[0].verified_events,before.rows[0].outbox_entries,before.rows[0].jobs],[1,0,0]);
  const settlement={event_id:settleEventId,event_type:'settlement.batch.complete',event_body:{
    merchant:{id:merchantId},transaction_ids:[transactionId],currency:'USD'
  }};
  const settleFirst=await webhook(settlement);
  const settleReplay=await webhook(settlement);
  assert.deepEqual([settleFirst.status,settleFirst.state],[200,'batch_recorded_dispatches_1']);
  assert.deepEqual([settleReplay.status,settleReplay.state],[200,'duplicate']);
  let observed=null, state=null;
  for(let i=0;i<20;i++){
    const result=await pool.query(`SELECT
      (SELECT count(*)::integer FROM growth_ops.litix_verified_payment_events WHERE event_id IN($1,$2)) AS verified_events,
      (SELECT count(*)::integer FROM growth_ops.litix_payment_dispatch_outbox WHERE order_id=$3) AS outbox_entries,
      (SELECT delivered_at FROM growth_ops.litix_payment_dispatch_outbox WHERE order_id=$3) AS delivered_at,
      (SELECT job_id FROM growth_ops.litix_payment_dispatch_outbox WHERE order_id=$3) AS job_id,
      (SELECT count(*)::integer FROM public.master_node_jobs WHERE order_id=$3) AS jobs,
      (SELECT node_id FROM public.master_node_jobs WHERE order_id=$3) AS node_id`,
      [saleEventId,settleEventId,orderId]);
    observed=result.rows[0];
    const job=observed.job_id ? await queue.getJob('litix-'+observed.job_id) : null;
    state=job ? await job.getState() : null;
    if(observed.delivered_at && state==='completed')break;
    await delay(1000);
  }
  assert.equal(observed.verified_events,2,'one unique sale plus one settlement');
  assert.equal(observed.outbox_entries,1,'one durable outbox entry');
  assert.equal(observed.jobs,1,'one staging job');
  assert.ok(observed.delivered_at,'relay dispatch marker');
  assert.equal(state,'completed','assigner acknowledged queue job');
  console.log('LITIX_PR183_STAGING_NO_CHARGE_PASS',JSON.stringify({
    synthetic:true,realMerchantEvent:false,orderId,
    saleFirst:saleFirst.state,saleReplay:saleReplay.state,
    settlementFirst:settleFirst.state,settlementReplay:settleReplay.state,
    verifiedEvents:observed.verified_events,orders:observed.jobs,outboxEntries:observed.outbox_entries,
    redisQueueState:state,assignedToRealNode:Boolean(observed.node_id)
  }));
  finished=true;
} catch(error){
  console.error('LITIX_PR183_STAGING_NO_CHARGE_FAIL',error instanceof Error ? error.message : String(error));
  process.exitCode=1;
} finally {
  await queue.close().catch(()=>{});
  await redis.quit().catch(()=>{});
  await pool.end().catch(()=>{});
}
if(!finished)process.exitCode=1;
