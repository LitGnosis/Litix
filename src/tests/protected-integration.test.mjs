import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isEligibleSupplierService } from '../lib/litixRefillPolicy.mjs';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('actual provider normalizes protected services and quotes 8x', async () => {
  const source = read('lib/provider.js').replace(/^import .*;\n/gm, '');
  const factory = new Function('isEligibleSupplierService', 'unstable_cache', 'crypto', source.replace(/export /g, '') + '\nreturn {normalizeService,retailCents};');
  const { createHash } = await import('node:crypto');
  const api = factory(isEligibleSupplierService, fn => fn, { createHash });
  const raw = {service:1, name:'Instagram Followers 365 days refill', refill:true, rate:5, min:10,max:10000};
  const service = api.normalizeService(raw, 'fixture');
  assert.equal(service.refillTermDays,365);
  assert.equal(service.retailRateUsd,40);
  assert.equal(api.retailCents(service,1000),4000);
  assert.equal(api.normalizeService({...raw,refill:false},'fixture').refillTermDays,0);
  assert.equal(api.normalizeService({...raw,name:'Facebook Followers 365 days refill'},'fixture'),null);
});
test('funded and reserve routing cannot fall back to unprotected services', () => {
  const source = read('lib/provider.js');
  for (const name of ['resolveFundedRoute','resolveReserveRoute']) {
    const body = source.split(`export async function ${name}`)[1].split('\n')[0];
    assert.match(body,/filter\(s=>s\?\.refillTermDays===365\)/);
  }
});
test('last build overlay contains exactly the tested production policy', () => {
  const files = ['lib/provider.js','lib/orders.js','lib/litixRefillPolicy.mjs','app/api/services/route.js','app/api/internal/checkout-canary/route.js'];
  for (const file of files) assert.equal(read('patches/protected-refill/assets/'+file),read(file));
  assert.match(read('scripts/vercel-build.sh'),/retire-integrations\/apply.cjs && node patches\/protected-refill\/apply.cjs && node patches\/checkout-handoff\/apply.cjs && node patches\/follower-offers\/apply.cjs && node --test/);
});
test('approved follower price order matches checkout without changing supplier costs', async () => {
  const source = read('lib/provider.js').replace(/^import .*;\n/gm, '');
  const factory = new Function('isEligibleSupplierService', 'unstable_cache', 'crypto', source.replace(/export /g, '') + '\nreturn {applyFollowerTierPrices,retailCents};');
  const api = factory(isEligibleSupplierService, fn => fn, {});
  const services = [
    {id:'a',platform:'Instagram',kind:'Followers',quality:'Regular',retailRateUsd:30.4952,providerRateUsd:3.8119},
    {id:'b',platform:'Instagram',kind:'Followers',quality:'High Quality',retailRateUsd:20.0448,providerRateUsd:2.5056},
    {id:'c',platform:'Instagram',kind:'Followers',quality:'Real',retailRateUsd:11.4952,providerRateUsd:1.4369},
    {id:'other',platform:'TikTok',kind:'Likes',quality:'Regular',retailRateUsd:2.3752,providerRateUsd:0.2969},
  ];
  const costs=services.map(s=>s.providerRateUsd);
  api.applyFollowerTierPrices(services);
  assert.deepEqual(services.slice(0,3).map(s=>api.retailCents(s,104)),[120,208,317]);
  assert.deepEqual(services.map(s=>s.providerRateUsd),costs);
  assert.equal(services[3].retailRateUsd,2.3752);
  api.applyFollowerTierPrices(services);
  assert.deepEqual(services.slice(0,3).map(s=>api.retailCents(s,104)),[120,208,317]);
});
