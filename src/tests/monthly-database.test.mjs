import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {monthlyRepository} from '../lib/monthly-repository.mjs';
test('isolated SQL migrations enforce creation idempotency, settlement matching and daily slots',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());
 for(const name of ['20261024-monthly-subscriptions.sql','20261024-monthly-lifecycle.sql'])await pg.exec(readFileSync(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 const repo=monthlyRepository({query:async(q,p)=>(await pg.query(q,p)).rows});
 const id='11111111-1111-4111-8111-111111111111';
 const reservation={id,email:'test@example.test',idempotencyKey:'22222222-2222-4222-8222-222222222222',quote:{likes:100,amountCents:50,consentVersion:'monthly-v1'},consentAt:'2026-01-01',managementTokenHash:'a'.repeat(64),managementTokenExpiresAt:'2030-01-01'};
 assert.equal((await repo.reserve(reservation)).created,true);assert.equal((await repo.reserve(reservation)).created,false);
 assert.equal(await repo.claimCreation(id),true);assert.equal(await repo.claimCreation(id),false);await repo.created(id,'123');
 let row=await repo.findById(id);assert.equal(row.billing_state,'pending');assert.equal(row.paid_through,null);
 const start=new Date(Date.now()-86400000).toISOString(),end=new Date(Date.now()+29*86400000).toISOString();
 const evidence={transactionId:'txn-1',amountCents:50,currency:'USD',periodStart:start,periodEnd:end};
 // Mismatched amount rolls back without changing entitlements.
 await assert.rejects(repo.recordSettlementAndExtend({subscription:row,evidence:{...evidence,amountCents:560}}));
 assert.equal((await repo.findById(id)).paid_through,null);
 assert.equal(await repo.recordSettlementAndExtend({subscription:row,evidence}),true);
 assert.equal(await repo.recordSettlementAndExtend({subscription:row,evidence}),false);
 assert.equal((await repo.findById(id)).billing_state,'active');
 for(let slot=1;slot<=3;slot++)await pg.query('insert into litix_monthly_post_claims(subscription_id,post_id,utc_day,daily_slot) values($1,$2,$3,$4)',[id,'post-'+slot,'2026-10-24',slot]);
 await assert.rejects(pg.query('insert into litix_monthly_post_claims(subscription_id,post_id,utc_day,daily_slot) values($1,$2,$3,$4)',[id,'post-4','2026-10-24',4]));
 await assert.rejects(pg.query('insert into litix_monthly_post_claims(subscription_id,post_id,utc_day,daily_slot) values($1,$2,$3,$4)',[id,'duplicate-slot','2026-10-24',3]));
 const a=await pg.query("update litix_monthly_subscriptions set cancellation_state='dispatching' where id=$1 and cancellation_state='none' returning id",[id]);
 const b=await pg.query("update litix_monthly_subscriptions set cancellation_state='dispatching' where id=$1 and cancellation_state='none' returning id",[id]);
 assert.equal(a.rows.length,1);assert.equal(b.rows.length,0);
});
