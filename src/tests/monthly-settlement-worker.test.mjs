import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
import {runSettlementBatch} from '../lib/monthly-settlement-worker.mjs';
test('queued settlement: verified amount required, duplicate suppressed, no supplier or live calls',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());
 for(const name of ['20261024-monthly-subscriptions.sql','20261024-monthly-lifecycle.sql','20261024-customer-accounts.sql','20261025-monthly-settlement-jobs.sql'])await pg.exec(readFileSync(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 const sql={query:async(q,p)=>(await pg.query(q,p)).rows},id='11111111-1111-4111-8111-111111111111';
 await sql.query(`insert into litix_monthly_subscriptions(id,management_token_hash,management_token_expires_at,provider_subscription_id,email,likes_per_post,amount_cents,consent_version,consent_at,idempotency_key) values($1,$2,'2099-01-01','123','test@example.test',100,560,'monthly-v1',now(),$3)`,[id,'a'.repeat(64),'22222222-2222-4222-8222-222222222222']);
 for(const txn of ['111','222'])await sql.query("insert into litix_monthly_settlement_jobs(subscription_id,transaction_id,period_start,period_end) values($1,$2,'2026-01-01','2026-02-01')",[id,txn]);
 const queryGateway=async({transactionId})=>({approved:true,transactionId,subscriptionId:'123',amountCents:transactionId==='111'?560:1,currency:'USD'});
 assert.deepEqual(await runSettlementBatch({sql,queryGateway,now:new Date('2026-01-15')}),{applied:1,duplicate:0,review:1});
 assert.deepEqual(await runSettlementBatch({sql,queryGateway}),{applied:0,duplicate:0,review:0});
 assert.equal((await sql.query('select * from litix_monthly_settlements')).length,1);
 await sql.query("update litix_monthly_settlement_jobs set state='pending' where transaction_id='111'");
 assert.deepEqual(await runSettlementBatch({sql,queryGateway}),{applied:0,duplicate:1,review:0});
});
