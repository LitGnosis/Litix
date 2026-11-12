// Co-located durable Litix first-party stream router.
// Never calls reseller APIs or claims completion. Signed owned-node agents
// independently prove delivery; this process only leases authorized jobs.
import {setTimeout as sleep} from 'node:timers/promises';
import {hostname} from 'node:os';

const STREAM='litix:fulfillment:queue';
const GROUP='litix-owned-node-router-v1';
const CONSUMER=(hostname().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,24)||'railway')+'-direct';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readJobId(record){
  const props=record?.[1];
  if(!Array.isArray(props))return '';
  for(let i=0;i+1<props.length;i+=2)if(props[i]==='job_id')return String(props[i+1]||'');
  return '';
}

async function publishQueued(db,redis){
  // Database remains authoritative. Republishing is safe because claims
  // require an exclusive row lock and the QUEUED state.
  const {rows}=await db.query(
    `SELECT id FROM growth_ops.direct_fulfillment_jobs
     WHERE status='QUEUED'
       AND (published_at IS NULL OR published_at<NOW()-INTERVAL '90 seconds')
     ORDER BY submitted_at LIMIT 30`
  );
  for(const item of rows){
    await redis.xadd(STREAM,'MAXLEN','~',100000,'*','job_id',String(item.id));
    await db.query(
      `UPDATE growth_ops.direct_fulfillment_jobs SET published_at=NOW()
       WHERE id=$1 AND status='QUEUED'`,[item.id]);
  }
}

async function reclaimExpired(db){
  await db.query(
    `UPDATE growth_ops.direct_fulfillment_jobs
     SET status=CASE WHEN attempts>=10 THEN 'REVIEW' ELSE 'QUEUED' END,
         lease_until=NULL,node_name=NULL,last_error='owned_node_receipt_timeout'
     WHERE status IN ('CLAIMED','ACKNOWLEDGED')
       AND lease_until<NOW() AND completed_at IS NULL`
  );
}

async function authorizeAndLease(db,jobId){
  if(!UUID.test(jobId))return {state:'invalid'};
  const conn=await db.connect();
  try{
    await conn.query('BEGIN');
    const {rows}=await conn.query(
      `SELECT id,service_kind,status,attempts
       FROM growth_ops.direct_fulfillment_jobs
       WHERE id=$1::uuid FOR UPDATE SKIP LOCKED`,[jobId]);
    const job=rows[0];
    if(!job){await conn.query('COMMIT');return {state:'unknown_or_locked'};}
    if(job.status!=='QUEUED'){await conn.query('COMMIT');return {state:'already_claimed'};}
    if(job.attempts>=10){
      await conn.query(
        `UPDATE growth_ops.direct_fulfillment_jobs
         SET status='REVIEW',last_error='max_delivery_attempts' WHERE id=$1`,[job.id]);
      await conn.query('COMMIT');
      return {state:'review'};
    }
    const candidates=await conn.query(
      `SELECT n.node_name,n.max_concurrency
       FROM growth_ops.first_party_nodes n
       JOIN growth_ops.first_party_node_keys k ON k.node_name=n.node_name
       WHERE n.status='ONLINE' AND n.last_heartbeat>NOW()-INTERVAL '90 seconds'
         AND k.enabled AND $1=ANY(k.authorized_services)
       ORDER BY n.last_heartbeat DESC LIMIT 10
       FOR UPDATE OF n SKIP LOCKED`,[job.service_kind]);
    for(const node of candidates.rows){
      const active=await conn.query(
        `SELECT count(*)::int AS count FROM growth_ops.direct_fulfillment_jobs
         WHERE node_name=$1 AND status IN ('CLAIMED','ACKNOWLEDGED')`,[node.node_name]);
      if(Number(active.rows[0]?.count||0)>=Number(node.max_concurrency||0))continue;
      const leased=await conn.query(
        `UPDATE growth_ops.direct_fulfillment_jobs
         SET status='CLAIMED',node_name=$2,attempts=attempts+1,
             lease_until=NOW()+INTERVAL '120 seconds',accepted_at=NOW()
         WHERE id=$1 AND status='QUEUED' RETURNING id`,[job.id,node.node_name]);
      await conn.query('COMMIT');
      return leased.rowCount===1
        ?{state:'leased',node:node.node_name,kind:job.service_kind}
        :{state:'already_claimed'};
    }
    await conn.query('COMMIT');
    return {state:'waiting_for_signed_owned_node'};
  }catch(err){
    await conn.query('ROLLBACK').catch(()=>{});
    throw err;
  }finally{conn.release();}
}

export async function startDirectStreamRouter(db,parentRedis,shouldStop){
  if(process.env.LITIX_DIRECT_STREAM_ROUTER_ENABLED!=='true')return;
  if(!process.env.REDIS_URL?.startsWith('rediss://'))
    throw Error('litix_direct_router_tls_redis_required');
  const redis=parentRedis.duplicate();
  try{
    await redis.ping();
    try{await redis.xgroup('CREATE',STREAM,GROUP,'0','MKSTREAM');}
    catch(err){if(!String(err?.message||err).includes('BUSYGROUP'))throw err;}
    await db.query('SELECT 1 FROM growth_ops.direct_fulfillment_jobs LIMIT 1');
    console.log('LITIX_DIRECT_STREAM_ROUTER_READY',{queue:STREAM,signedNodeRequired:true});
    let lastReclaim=0,lastLog=0;
    while(!shouldStop()){
      try{
        await publishQueued(db,redis);
        if(Date.now()-lastReclaim>15000){await reclaimExpired(db);lastReclaim=Date.now();}
        const messages=await redis.xreadgroup('GROUP',GROUP,CONSUMER,'COUNT',10,'BLOCK',2000,'STREAMS',STREAM,'>');
        if(!Array.isArray(messages))continue;
        for(const [,items] of messages){
          for(const item of items||[]){
            const msgId=item?.[0],jobId=readJobId(item);
            try{
              const outcome=await authorizeAndLease(db,jobId);
              if(outcome.state==='leased'){
                // Node consumes this stream through its separately authorized
                // signed-receipt channel. Do not mark the job complete here.
                await redis.xadd('litix:node:'+outcome.node+':jobs','MAXLEN','~',25000,'*',
                  'job_id',jobId,'kind',outcome.kind);
              }else if(outcome.state==='waiting_for_signed_owned_node'&&Date.now()-lastLog>60000){
                lastLog=Date.now();
                console.warn('LITIX_DIRECT_STREAM_ROUTER_WAITING_FOR_SIGNED_NODE');
              }
              await redis.xack(STREAM,GROUP,msgId);
            }catch(err){
              console.error('LITIX_DIRECT_STREAM_JOB_RETRY',{
                type:String(err?.name||'Error').slice(0,60)});
              // Never ACK an unverified, failed dispatch; expired DB leases
              // and the publisher make recovery idempotent.
            }
          }
        }
      }catch(err){
        console.error('LITIX_DIRECT_STREAM_ROUTER_RETRY',{
          type:String(err?.name||'Error').slice(0,60)});
        if(!shouldStop())await sleep(3000);
      }
    }
  }finally{await redis.quit().catch(()=>redis.disconnect());}
}
