import { setTimeout as sleep } from 'node:timers/promises';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import pg from 'pg';
const { Pool } = pg;

const interval = 3000;
const queueName = 'litix-first-party-dispatch';

async function main() {
  if (process.env.LITIX_OWNED_DISPATCH_ENABLED !== 'true') throw new Error('Dispatch disabled');
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) throw new Error('Database or Redis missing');
  const db = new Pool({connectionString:process.env.DATABASE_URL,max:3,application_name:'litix_payment_relay'});
  const redis = new IORedis(process.env.REDIS_URL,{maxRetriesPerRequest:null,enableReadyCheck:true});
  const queue=new Queue(queueName,{connection:redis});
  let stopping=false;
  process.once('SIGTERM',()=>{stopping=true;});
  process.once('SIGINT',()=>{stopping=true;});
  try {
    while(!stopping) {
      const claimed=await db.query<{order_id:string,job_id:string}>(
        `UPDATE growth_ops.litix_payment_dispatch_outbox
         SET lock_until=NOW()+INTERVAL '60 seconds',attempts=attempts+1
         WHERE order_id IN (
           SELECT order_id FROM growth_ops.litix_payment_dispatch_outbox
           WHERE delivered_at IS NULL AND (lock_until IS NULL OR lock_until<NOW())
           ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 15
         ) RETURNING order_id,job_id`,
      );
      for(const task of claimed.rows) {
        try {
          const exists=await db.query(
            `SELECT 1 FROM master_node_jobs WHERE id=$1 AND order_id=$2 AND status='queued'`,
            [task.job_id,task.order_id],
          );
          if(!exists.rowCount) throw new Error('job_requires_operator_review');
          await queue.add('first-party-wakeup',{jobId:task.job_id},
            {jobId:`litix-${task.job_id}`,attempts:1,removeOnComplete:false,removeOnFail:false});
          await db.query(`UPDATE growth_ops.litix_payment_dispatch_outbox
             SET delivered_at=NOW(),lock_until=NULL,last_error=NULL WHERE order_id=$1 AND job_id=$2`,
             [task.order_id,task.job_id],
          );
        } catch(error) {
          await db.query(`UPDATE growth_ops.litix_payment_dispatch_outbox SET lock_until=NULL,
            last_error=$2 WHERE order_id=$1`,[task.order_id,error instanceof Error?error.message.slice(0,80):'UNKNOWN']);
        }
      }
      if(!stopping)await sleep(interval);
    }
  } finally {await queue.close();await redis.quit();await db.end();}
}
void main().catch((error)=>{
  console.error('litix_relay_stopped',{reason:error instanceof Error?error.name:'UNKNOWN'});
  process.exitCode=1;
});
