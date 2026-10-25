import {applyVerifiedSettlement} from './monthly-lifecycle.mjs';
import {monthlyRepository} from './monthly-repository.mjs';
// Bounded, atomic claims. Ambiguous outcomes go to review, never blind retries.
// A crash leaves processing visible for operator reconciliation, not auto-replay.
export async function runSettlementBatch({sql,queryGateway,limit=5,now=new Date()}){
 if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('Invalid batch limit');
 const jobs=await sql.query(`update litix_monthly_settlement_jobs set state='processing',claimed_at=now()
 where id in (select id from litix_monthly_settlement_jobs where state='pending' order by id for update skip locked limit $1)
 and state='pending' returning *`,[limit]);
 const repository=monthlyRepository(sql),counts={applied:0,duplicate:0,review:0};
 for(const job of jobs){
  let state='review';
  try{
   const start=new Date(job.period_start).toISOString(),end=new Date(job.period_end).toISOString();
   const applied=await applyVerifiedSettlement({subscriptionId:job.subscription_id,repository,now,queryGateway:async subscription=>({...await queryGateway({transactionId:job.transaction_id,subscription}),periodStart:start,periodEnd:end})});
   state=applied?'applied':'duplicate';
  }catch{/* Do not store provider payloads or credentials in job errors. */}
  await sql.query("update litix_monthly_settlement_jobs set state=$2,completed_at=now() where id=$1 and state='processing'",[job.id,state]);counts[state]++;
 }
 return counts;
}
