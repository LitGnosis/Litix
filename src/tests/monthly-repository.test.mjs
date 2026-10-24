import test from 'node:test';import assert from 'node:assert/strict';
import {monthlyRepository} from '../lib/monthly-repository.mjs';
test('Neon reservation parameterizes data and relies on durable unique key',async()=>{
 let query,params;const repo=monthlyRepository({query:async(q,p)=>{query=q;params=p;return [{id:'id'}]}});
 assert.equal((await repo.reserve({id:'id',email:'test@example.test',idempotencyKey:'key',quote:{likes:100,amountCents:50,consentVersion:'v1'},consentAt:'date',managementTokenHash:'hash',managementTokenExpiresAt:'expiry'})).created,true);
 assert.match(query,/on conflict\(idempotency_key\) do nothing/);assert.ok(!query.includes('test@example.test'));assert.equal(params[4],50);
});
test('creation claim is conditional; missing write acknowledgement requires reconciliation',async()=>{
 const repo=monthlyRepository({query:async q=>{if(q.includes("creation_state='reserved'"))assert.match(q,/returning id/);return []}});
 assert.equal(await repo.claimCreation('id'),false);await assert.rejects(repo.created('id','123'));
});
test('verified settlement uses atomic database function',async()=>{
 let params;const repo=monthlyRepository({query:async(q,p)=>{assert.match(q,/select litix_monthly_apply_settlement/);params=p;return [{applied:false}]}});
 assert.equal(await repo.recordSettlementAndExtend({subscription:{id:'id'},evidence:{transactionId:'txn',amountCents:50,currency:'USD',periodStart:'start',periodEnd:'end'}}),false);assert.deepEqual(params,['id','txn',50,'USD','start','end']);
});
