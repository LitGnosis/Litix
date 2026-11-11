import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pg from 'pg';
const { Pool } = pg;

async function main() {
  if(process.env.LITIX_OWNED_DISPATCH_ENABLED!=='true')throw new Error('Dispatch disabled');
  if(!process.env.REDIS_URL || !process.env.DATABASE_URL)throw new Error('Redis/Neon missing');
  const db=new Pool({connectionString:process.env.DATABASE_URL,max:4,
    application_name:'litix_owned_queue_assigner'});
  const redis=new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
  const worker=new Worker('litix-first-party-dispatch',async(event)=>{
    const jobId=String(event.data.jobId || '');
    if(!/^[0-9a-f-]{36}$/i.test(jobId))throw new Error('invalid_job_id');
    const connection=await db.connect();
    try {
      await connection.query('BEGIN');
      const selected=await connection.query<{id:string;kind:string;tenant_key:string}>(
        `SELECT id,kind,tenant_key FROM master_node_jobs WHERE id=$1 AND status='queued'
         FOR UPDATE SKIP LOCKED`,[jobId]);
      if(!selected.rowCount){await connection.query('COMMIT');return {state:'not_queued'};}
      const item=selected.rows[0];
      const eligibleType=item.kind==='website_preview'?'compute':'qa_device';
      const nodes=await connection.query<{id:string;capacity:number}>(
        `SELECT id,capacity FROM master_execution_nodes WHERE owned AND enabled AND kind=$1
        AND last_seen>NOW()-INTERVAL '90 seconds'
        ORDER BY CASE WHEN affinity_key=$2 THEN 0 ELSE 1 END,id
        FOR UPDATE SKIP LOCKED LIMIT 20`,[eligibleType,item.tenant_key]);
      for(const node of nodes.rows){
        const current=await connection.query<{count:string}>(
          `SELECT COUNT(*)::text as count FROM master_node_jobs WHERE node_id=$1 AND status IN ('queued','running')`,[node.id]);
        if(Number(current.rows[0].count)>=node.capacity)continue;
        await connection.query(`UPDATE master_node_jobs SET node_id=$1 WHERE id=$2 AND status='queued'`,[node.id,item.id]);
        await connection.query(`UPDATE master_execution_nodes SET affinity_key=$1 WHERE id=$2`,[item.tenant_key,node.id]);
        await connection.query('COMMIT');
        return {state:'assigned'};
      }
      await connection.query('COMMIT');
      return {state:'awaiting_healthy_owned_node'};
    } catch(error) {await connection.query('ROLLBACK').catch(()=>{});throw error;}
    finally{connection.release();}
  },{connection:redis,concurrency:4});
  worker.on('failed',(_job,error)=>console.error('litix_owned_assigner_failed',{reason:error.name}));
  async function terminate(){await worker.close();await redis.quit();await db.end();}
  process.once('SIGINT',()=>void terminate());
  process.once('SIGTERM',()=>void terminate());
}
void main().catch(error=>{console.error('litix_owned_assigner_stopped',{reason:error instanceof Error?error.name:'UNKNOWN'});process.exitCode=1;});