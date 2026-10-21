import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('unqualified historical service IDs do not default to another supplier',async()=>{
 const {decodeServiceKey}=await load(read('lib/serviceKey.js'));
 assert.deepEqual(decodeServiceKey('123'),{provider:null,serviceId:'123'});
 assert.deepEqual(decodeServiceKey('smmglob:123'),{provider:'smmglob',serviceId:'123'});
});
test('removed payout rail cannot be activated through environment settings',async()=>{
 const m=await load(read('lib/reserveManager.js'));
 assert.equal(m.reserveRouteCapable('smmpet'),false);
 assert.deepEqual(await m.ensureSupplierReserve(),{ok:false,status:'not_configured'});
});
test('active payment code retains supported gateway without retired integrations',()=>{
 for(const file of ['lib/paymentGateway.js','lib/provider.js','lib/orders.js','lib/reserveManager.js','lib/serviceKey.js'])assert.doesNotMatch(read(file),/heleket|owlet/i);
 assert.match(read('lib/paymentGateway.js'),/requireVerifiedPaymentGateway/);
 assert.match(read('lib/paymentGateway.js'),/hostedPaykings/);
 assert.equal(existsSync(new URL('../app/api/payments/heleket/webhook/route.js',import.meta.url)),false);
});
