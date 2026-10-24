import test from 'node:test';
import assert from 'node:assert/strict';
import {bearer,newManagementToken,digestToken,manageSubscription} from '../lib/subscription-management.mjs';
const row={id:'test',provider_subscription_id:'123',cancellation_state:'none',paid_through:'2027-01-01',amount_cents:50,email:'private@example.test',management_token_hash:'secret'};
function harness(gateway){let record={...row},calls=0;const repository={find:async hash=>hash===digestToken('valid')?{...record}:null,claim:async()=>{if(record.cancellation_state!=='none')return null;record.cancellation_state='dispatching';return {...record}},finish:async(id,state)=>{record.cancellation_state=state}};return {run:(token='valid',cancel=true)=>manageSubscription({token,cancel,repository,gateway:async id=>{calls++;return gateway(id)}}),get calls(){return calls},get state(){return record.cancellation_state}}}
test('management secrets are random, hashed, and require bearer syntax',()=>{const a=newManagementToken(),b=newManagementToken();assert.notEqual(a.token,b.token);assert.equal(a.hash,digestToken(a.token));assert.equal(bearer(new Headers({authorization:'Bearer '+a.token})),a.token);assert.equal(bearer(new Headers({authorization:'Bearer short'})),null)});
test('invalid ownership never calls gateway and response excludes private data',async()=>{const h=harness(()=>({state:'renewal_stopped'}));assert.equal((await h.run(null)).status,401);assert.equal((await h.run('wrong')).status,404);const view=await h.run('valid',false);assert.equal(view.body.subscription.email,undefined);assert.equal(view.body.subscription.management_token_hash,undefined);assert.equal(h.calls,0)});
test('concurrent cancellation claims dispatch once and repeated confirmed cancellation is idempotent',async()=>{const h=harness(async()=>({state:'renewal_stopped'}));await Promise.all([h.run(),h.run()]);assert.equal(h.calls,1);assert.equal(h.state,'confirmed');const r=await h.run();assert.equal(r.status,200);assert.equal(h.calls,1)});
test('unknown gateway outcome remains review and cannot blindly retry',async()=>{const h=harness(()=>({state:'review',code:'unknown_gateway_outcome'}));assert.equal((await h.run()).status,202);assert.equal(h.state,'review');await h.run();assert.equal(h.calls,1)});
test('management route is disabled by default even with existing live credentials',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../app/api/subscriptions/v1/manage/route.js',import.meta.url),'utf8')
 .replace("import {neon} from '@neondatabase/serverless';","const neon=()=>{throw Error('Database must not be accessed')};")
 .replace("import {bearer,manageSubscription} from '../../../../../lib/subscription-management.mjs';","const bearer=()=>{throw Error('Unexpected auth access')};")
 .replace("import {cancelRecurring} from '../../../../../lib/nmi-recurring.mjs';","const cancelRecurring=()=>{throw Error('Gateway must not be accessed')};");
 const old=process.env.LITIX_MONTHLY_MANAGEMENT_ENABLED;delete process.env.LITIX_MONTHLY_MANAGEMENT_ENABLED;
 try{const {GET,POST}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));for(const fn of [GET,POST])assert.equal((await fn(new Request('https://example.test'))).status,503)}finally{if(old!==undefined)process.env.LITIX_MONTHLY_MANAGEMENT_ENABLED=old}
});
