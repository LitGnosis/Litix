import test from 'node:test';
import assert from 'node:assert/strict';
import {processVerifiedBundleOrder,providerPayload,providerConfiguration} from '../patches/service-catalog/src/lib/litixCatalogFulfillment.mjs';
import {packages} from '../patches/bundle-activation/src/lib/packages.js';
import {processSettledBundleOrder} from '../patches/bundle-activation/src/lib/paykings-bundle-hook.js';
const pkg=packages.at(-1);
function fixture(){let claimed=false;const calls=[];return {calls,repository:{claim:async()=>claimed?null:(claimed=true,{packageId:pkg.id,customerTargetUsername:'example'}),review:async(...args)=>calls.push(['review',...args]),submitted:async(...args)=>calls.push(['submitted',...args])}};}
const providers=[{id:'autosm',url:'https://auto-sm.com/api/v2',key:'test-only'},{id:'smmcpan',url:'https://smmcpan.com/api/v2',key:'test-only'}];
test('explicit mappings and subscription payload',()=>{
 assert.deepEqual(pkg.providerServiceIds,{autosm:1420,smmglory:3110,smmcpan:4910});
 assert.deepEqual(providerPayload(pkg,{customerTargetUsername:'@example'},'autosm'),{action:'add',service:'1420',username:'example',min:'100',max:'120',posts:'30'});
 assert.throws(()=>providerPayload(pkg,{customerTargetUsername:'https://instagram.com/example'},'autosm'));
 assert.equal(providerConfiguration({})[0].key,undefined);
});
test('timeouts do not switch panels or resubmit',async()=>{
 const f=fixture();let requests=0;
 const options={...f,packages,providers,fetchImpl:async()=>{requests++;throw new Error('timeout');}};
 assert.equal((await processVerifiedBundleOrder('id',options)).reconciliationRequired,true);
 assert.equal((await processVerifiedBundleOrder('id',options)).skipped,true);
 assert.equal(requests,1);assert.equal(f.calls[0][0],'review');
});
test('valid token is submitted, not completed',async()=>{
 const f=fixture();const result=await processVerifiedBundleOrder('id',{...f,packages,providers,fetchImpl:async()=>({ok:true,json:async()=>({subscription:123})})});
 assert.equal(result.status,'submitted');assert.equal(f.calls[0][0],'submitted');
});
test('malformed response never falls through',async()=>{
 const f=fixture();let requests=0;
 const result=await processVerifiedBundleOrder('id',{...f,packages,providers,fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({})};}});
 assert.equal(result.reconciliationRequired,true);assert.equal(requests,1);
});
test('unverified settlement cannot fulfill',async()=>{
 let fulfilled=false;
 const result=await processSettledBundleOrder('ltx_example',{repository:{verifySettledPayment:async()=>false},fulfill:async()=>{fulfilled=true;}});
 assert.equal(result.code,'SETTLEMENT_NOT_VERIFIED');assert.equal(fulfilled,false);
});
test('verified NMI outbox settlement can fulfill',async()=>{
 let fulfilled=false;
 const result=await processSettledBundleOrder('ltx_example',{repository:{verifySettledPayment:async()=>true},fulfill:async()=>{fulfilled=true;return {success:true};}});
 assert.equal(result.success,true);assert.equal(fulfilled,true);
});
