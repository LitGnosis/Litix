import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {spawnSync} from 'node:child_process';
const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const apply=path.join(packageRoot,'scripts/apply-to-current-litix.mjs');
function testFixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'litix-verified-release-'));
  for(const dir of ['src/lib','src/app/api/services'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  const provider=`import crypto from 'node:crypto';
const ALLOWED_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X', 'Spotify', 'Telegram', 'Discord', 'Twitch', 'LinkedIn', 'Kick'];
export function markupMultiplier() { return 15; }
const refill = boolCapability(raw, 'refill', combined, /refill|drop protection/i, /refill\\s*:\\s*no|no\\s*refill|\\bNR\\b/i);
refill, cancel, dripfeed,
subscription: /subscription|auto/i.test(String(raw.type || combined)),
const all = results.flat();
return raw ? normalizeService(raw, provider.id) : null;
["litix-supplier-catalog-retired-integrations-v1"]`;
  const orders=`export async function createOrder({id,service,target,quantity,providerCost:cost,providerCostUsd:costUsd,retailCents,email,paymentProvider='disabled',deliveryPlan={}}){const sql=db();}
service.refill?new Date(Date.now()+30*86400000).toISOString():null
route.service.refill?new Date(Date.now()+30*86400000).toISOString():null`;
  fs.writeFileSync(path.join(root,'src/lib/provider.js'),provider);
  fs.writeFileSync(path.join(root,'src/lib/orders.js'),orders);
  fs.writeFileSync(path.join(root,'src/app/api/services/route.js'),'refill:s.refill,cancel:s.cancel');
  return{root,provider};
}
test('source patch validates in dry-run without changing files; installs and rejects re-installation',()=>{
  const {root,provider}=testFixture();
  try{
    const run=(args=[])=>spawnSync(process.execPath,[apply,...args],{cwd:root,encoding:'utf8'});
    const dry=run(['--check']);assert.equal(dry.status,0,dry.stderr);
    assert.equal(fs.readFileSync(path.join(root,'src/lib/provider.js'),'utf8'),provider);
    const live=run();assert.equal(live.status,0,live.stderr);
    const modified=fs.readFileSync(path.join(root,'src/lib/provider.js'),'utf8');
    assert.match(modified,/ALLOWED_PLATFORMS = \['Instagram', 'TikTok', 'YouTube'\]/);
    assert.match(modified,/markupMultiplier\(\) \{ return 8/);
    assert.match(modified,/isEligibleSupplierService/);
    assert.match(modified,/filter\(s => s.refillTermDays === 365\)/);
    assert.match(modified,/resolved\?\.refillTermDays === 365/);
    assert.ok(fs.existsSync(path.join(root,'src/app/api/internal/checkout-canary/route.js')));
    assert.ok(fs.existsSync(path.join(root,'src/lib/litixRefillPolicy.mjs')));
    const orders=fs.readFileSync(path.join(root,'src/lib/orders.js'),'utf8');
    assert.match(orders,/365\*86400000/);
    assert.match(orders,/Selected supplier service is not eligible/);
    assert.match(fs.readFileSync(path.join(root,'src/app/api/services/route.js'),'utf8'),/refillTermDays/);
    assert.notEqual(run().status,0,'duplicate patch fails closed');
  } finally {fs.rmSync(root,{recursive:true,force:true})}
});
test('source patch fails closed when current source deviates',()=>{
  const {root}=testFixture();
  try{
    const f=path.join(root,'src/lib/provider.js');
    fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('return 15','return 12'));
    const result=spawnSync(process.execPath,[apply],{cwd:root,encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.equal(fs.existsSync(path.join(root,'src/lib/litixRefillPolicy.mjs')),false);
  } finally {fs.rmSync(root,{recursive:true,force:true})}
});
