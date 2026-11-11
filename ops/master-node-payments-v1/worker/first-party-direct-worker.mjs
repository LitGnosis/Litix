// Litix-owned job executor. No reseller SDK, credentials, catalog or order APIs.
// Executes only the first-party website_preview deliverable and stores proof.
// No social engagement, likes, views, follows or simulated completion.
import {createHash} from 'node:crypto';
import {Worker} from 'bullmq';
import Redis from 'ioredis';
import pg from 'pg';

const {Pool}=pg;
const NODE_ID='litix-direct-primary-01';
const QUEUE='litix-first-party-dispatch';
const OWNED_API='https://www.litix.net/api/direct-smm/creative-kit';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fixtureBrief=Object.freeze({
  brand:'Litix',campaign:'first-party-fulfillment-qa',
  audience:'independent business owners',pain:'unstructured content planning and missed leads',
  solution:'a clear original content calendar with accountable campaign links',
  cta:'Explore Litix Growth Studio',landingUrl:'https://www.litix.net/growth-studio'
});
const isTest=process.env.LITIX_FIRST_PARTY_TEST_MODE==='true';

function assertConfig(){
  if(process.env.LITIX_FIRST_PARTY_ENABLED!=='true')throw Error('direct_worker_disabled');
  if(process.env.LITIX_FIRST_PARTY_NODE_ID!==NODE_ID)throw Error('direct_node_identity_mismatch');
  if(!process.env.DATABASE_URL?.startsWith('postgres'))throw Error('direct_worker_database_missing');
  if(!process.env.REDIS_URL?.startsWith('rediss://'))throw Error('direct_worker_tls_redis_required');
  if(!isTest&&process.env.LITIX_FIRST_PARTY_LIVE_ENABLED!=='true')throw Error('direct_worker_live_release_required');
}
const hash=data=>createHash('sha256').update(data).digest('hex');
function verifiedBrief(item){
  if(isTest){
    if(item.payload?.isSyntheticTest!==true||!item.order_id.startsWith('pr183_qa_'))
      throw Error('test_fixture_not_authorized');
    return fixtureBrief;
  }
  if(item.payload?.isSyntheticTest===true)throw Error('synthetic_order_not_live');
  if(!item.payload?.brief||typeof item.payload.brief!=='object')
    throw Error('first_party_brief_missing');
  const b=item.payload.brief;
  const o={};
  for(const k of ['brand','campaign','audience','pain','solution','cta','landingUrl']){
    if(typeof b[k]!=='string'||b[k].length<3||b[k].length>350)
      throw Error('first_party_brief_invalid');
    o[k]=b[k];
  }
  if(!/^https:\/\//.test(o.landingUrl))throw Error('first_party_destination_invalid');
  return o;
}
async function deliver(brief){
  const response=await fetch(OWNED_API,{
    method:'POST',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify(brief),
    redirect:'error',
    signal:AbortSignal.timeout(15000),
    cache:'no-store'
  });
  if(!response.ok)throw Error('first_party_api_http_'+response.status);
  const data=await response.json();
  if(data.service!=='litix_first_party_growth_kit'||data.status!=='generated_draft'||
    data.chargeAttempted!==false||data.supplierApiCalled!==false||
    data.actualLikesOrFollowersDelivered!==false||
    !Array.isArray(data.kit?.variants)||data.kit.variants.length!==12)
    throw Error('first_party_delivery_not_verified');
  const artifact=JSON.stringify({source:'Litix',kind:'website_preview',
    generatedAt:new Date().toISOString(),synthetic:isTest,kit:data.kit});
  if(Buffer.byteLength(artifact,'utf8')>400_000)throw Error('first_party_artifact_too_large');
  return {artifact,sha256:hash(artifact),drafts:12};
}

async function main(){
  assertConfig();
  const db=new Pool({connectionString:process.env.DATABASE_URL,max:3,
    connectionTimeoutMillis:9000,application_name:'litix_first_party_direct_worker'});
  const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null,enableReadyCheck:true});
  let stopping=false,busyHeartbeat=false;
  const heartbeat=async()=>{
    if(stopping||busyHeartbeat)return;
    busyHeartbeat=true;
    try{
      await redis.ping();
      const result=await db.query(
        `UPDATE growth_ops.first_party_nodes
         SET status='ONLINE',last_heartbeat=NOW(),updated_at=NOW()
         WHERE node_name=$1 AND node_type='FIRST_PARTY_COMPUTE'
           AND endpoint_or_serial='railway-worker-internal'
           AND status IN ('REGISTERED','OFFLINE','ONLINE')
         RETURNING id`,[NODE_ID]);
      if(result.rowCount!==1)throw Error('direct_node_not_registered');
      const owned=await db.query(
        `INSERT INTO public.master_execution_nodes(id,kind,owned,enabled,capacity,last_seen)
         VALUES($1,'compute',true,true,1,NOW())
         ON CONFLICT(id) DO UPDATE SET
           enabled=true,last_seen=NOW()
         WHERE public.master_execution_nodes.owned=true
           AND public.master_execution_nodes.kind='compute'
         RETURNING id`,[NODE_ID]);
      if(owned.rowCount!==1)throw Error('direct_node_registry_conflict');
    }finally{busyHeartbeat=false;}
  };
  let worker;
  try{
    await redis.ping();
    await db.query('SELECT 1');
    await heartbeat();
    console.log('LITIX_DIRECT_NODE_HEARTBEAT_VERIFIED',{node:NODE_ID,mode:isTest?'STAGING_NO_CHARGE':'LIVE'});
    worker=new Worker(QUEUE,async queueJob=>{
      const jobId=String(queueJob.data?.jobId||'');
      if(!UUID.test(jobId))throw Error('direct_invalid_job_id');
      const conn=await db.connect();
      let item;
      try{
        await conn.query('BEGIN');
        const rows=await conn.query(
          `SELECT j.id,j.order_id,j.kind,j.payload,j.status,
             g.kind AS grant_kind,g.revoked_at,g.expires_at,
             i.provider_transaction_id,i.execution_approved,i.state AS payment_state
           FROM public.master_node_jobs j
           JOIN public.master_fulfillment_grants g ON g.order_id=j.order_id
           JOIN growth_ops.litix_owned_payment_intents i ON i.order_id=j.order_id
           WHERE j.id=$1 FOR UPDATE OF j`,[jobId]);
        item=rows.rows[0];
        if(!item){await conn.query('COMMIT');return {state:'not_authorized'};}
        if(item.status!=='queued'){await conn.query('COMMIT');return {state:'already_claimed'};}
        if(item.kind!=='website_preview'||item.grant_kind!==item.kind||
           item.revoked_at||item.expires_at&&new Date(item.expires_at)<new Date()||
           item.execution_approved!==true||
           !['dispatch_pending','dispatched','settled'].includes(item.payment_state))
          throw Error('direct_job_not_approved');
        const payment=await conn.query(
          `SELECT 1 FROM growth_ops.litix_nmi_settled_transactions
           WHERE transaction_id=$1 LIMIT 1`,[item.provider_transaction_id]);
        if(payment.rowCount!==1)throw Error('direct_settlement_not_verified');
        // Reject all engagement jobs: no proof of a real connected platform account.
        const brief=verifiedBrief(item);
        await conn.query(
          `UPDATE public.master_node_jobs SET status='running',node_id=$2,
             attempts=attempts+1,started_at=NOW(),
             lease_token=gen_random_uuid(),lease_until=NOW()+INTERVAL '45 seconds'
           WHERE id=$1 AND status='queued'`,[jobId,NODE_ID]);
        await conn.query('COMMIT');
        const actual=await deliver(brief);
        await conn.query('BEGIN');
        await conn.query(
          `INSERT INTO public.master_private_artifacts(job_id,mime_type,content)
           VALUES($1,'application/json',$2) ON CONFLICT(job_id) DO NOTHING`,
          [jobId,actual.artifact]);
        const done=await conn.query(
          `UPDATE public.master_node_jobs SET status='succeeded',
             result=$2::jsonb,finished_at=NOW(),lease_token=NULL,lease_until=NULL
           WHERE id=$1 AND node_id=$3 AND status='running'
           RETURNING id`,
          [jobId,JSON.stringify({state:'COMPLETED',delivery:'first_party_creative_kit',
             drafts:actual.drafts,sha256:actual.sha256,synthetic:isTest,
             paidEngagementDelivered:false}),NODE_ID]);
        if(done.rowCount!==1)throw Error('direct_completion_claim_lost');
        await conn.query('COMMIT');
        console.log('LITIX_FIRST_PARTY_DELIVERY_COMPLETED',{
          jobId,orderId:item.order_id,sha256:actual.sha256,drafts:actual.drafts,
          synthetic:isTest,supplierCalls:0});
        return {state:'COMPLETED',jobId,sha256:actual.sha256,synthetic:isTest};
      }catch(error){
        await conn.query('ROLLBACK').catch(()=>{});
        if(item?.id)await db.query(
          `UPDATE public.master_node_jobs SET
              status='needs_review',last_error_code=$2,
              lease_token=NULL,lease_until=NULL,finished_at=NOW()
            WHERE id=$1 AND status IN ('running','queued')`,
          [item.id,String(error?.message??'direct_error').slice(0,100)]).catch(()=>{});
        throw error;
      }finally{conn.release();}
    },{connection:redis,concurrency:1,lockDuration:60000});
    worker.on('failed',(_job,error)=>console.error('LITIX_FIRST_PARTY_JOB_REVIEW',{reason:String(error?.message??'unknown').slice(0,100)}));
    const ticker=setInterval(()=>void heartbeat().catch(error=>
      console.error('LITIX_DIRECT_HEARTBEAT_FAILED',{reason:String(error?.message??'unknown').slice(0,90)})),12000);
    async function stop(){
      if(stopping)return;
      stopping=true;clearInterval(ticker);
      await worker.close().catch(()=>{});
      await db.query(
        "UPDATE growth_ops.first_party_nodes SET status='OFFLINE',updated_at=NOW() WHERE node_name=$1",
        [NODE_ID]).catch(()=>{});
      await db.query(
        'UPDATE public.master_execution_nodes SET enabled=false WHERE id=$1',[NODE_ID]).catch(()=>{});
      await redis.quit().catch(()=>{});
      await db.end().catch(()=>{});
    }
    process.once('SIGTERM',()=>void stop());
    process.once('SIGINT',()=>void stop());
  }catch(error){
    console.error('LITIX_DIRECT_WORKER_STARTUP_FAILED',{reason:String(error?.message??'unknown').slice(0,120)});
    await redis.quit().catch(()=>{});await db.end().catch(()=>{});
    process.exitCode=1;
  }
}
void main();
