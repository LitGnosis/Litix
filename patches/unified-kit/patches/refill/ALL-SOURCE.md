# Litix release — complete source code, untruncated

## .github/workflows/litix-protection-preflight.yml

```yaml
name: Litix Protected-Services Preflight
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Verify protection/pricing and no-charge simulation
        run: node --test tests/policy.test.mjs tests/source-patch.test.mjs
      - name: Check source integration and build
        run: |
          if [ -f src/package.json ]; then
            cd src
          fi
          npm ci
          npm run build
# No deployment or Slack notifications are claimed here.
# Vercel Git integration should deploy only after project checks pass.

```

## README.md

```markdown
# Litix production-source integration release (Oct 19, 2026)

**Additive patch ONLY. This archive is NOT a complete deployment. No GitHub commit or production deployment performed.**

## Goals
- Keep **Instagram, TikTok, YouTube** only in the custom storefront catalog.
- Supplier must report `refill:true` AND explicitly label 365 days / 1 year / 12 months / lifetime (as verified in live catalog); no fallback to an unprotected service.
- Customer custom retail rate: exactly **8× the actual supplier's USD per 1000**; pricing is validated server-side. Preset bundle pricing is not edited by this patch.
- New eligible orders: refill expiration stored as 365 days. Existing orders unaffected.
- Preview-only internal mock route: `/api/internal/checkout-canary`, `POST`, Bearer `LITIX_MOCK_TEST_SECRET` (>=32 characters). No PayKings/Collect.js network call, no card charge, no SmmGlob `add`, `refill`, or `status` write. The mock does not certify payment settlement or automatic post-delivery monitoring.

## Integration into *complete latest* GitHub checkout
Keep this package in a separate folder next to the real repository. Run the installer from within the repo, pointing to its path in the separate package. The installer installs the helper and mock route itself. Only after installation, copy the package's `scripts/`, `tests/`, and `.github/workflows/` to the repository, merging without overwriting unrelated files.

```sh
node --test /path/to/release/tests/policy.test.mjs /path/to/release/tests/source-patch.test.mjs
# Run these commands from the root of the complete current Git checkout:
node /path/to/release/scripts/apply-to-current-litix.mjs --check
node /path/to/release/scripts/apply-to-current-litix.mjs
# Merge release scripts/, tests/ and .github/workflows/ into repo root; inspect git diff.
cd src && npm ci && npm run build
# Review git diff, create commit, and let the connected Vercel Git integration deploy.
```

The current Litix Next.js app lives under `src/`. Run npm commands from inside that directory, and keep `scripts` and `tests` at the repository root. Do not replace the existing Vercel `vercel.json` cron setup, premium frontend, or PayKings checkout with a generic HTML dashboard or `/api/checkout.js` file.

## Smoke checks required in preview before production
- `GET /api/services` returns only Instagram/TikTok/YouTube, with `refill:true` and `refillTermDays:365` for every item.
- Test direct service IDs for Facebook, X, Snapchat, unprotected followers and protected SmmGlob services; only matching protected products pass.
- Verify pricing for known supplier rates and realistic quantities, and check checkout total matches display.
- Verify old customer orders remain readable and preset bundle prices are unchanged.
- The mock route should report simulated tokenization and calculated retail, all charge/settlement/supplier flags FALSE.
- Validate PayKings in authorized test mode separately; never send synthetic payment tokens to live NMI. Then verify a real settlement/fulfillment only using an explicitly authorized live test order.
- Inspect actual supplier status/refill policies, webhook receipt, and post-completion loss monitoring. Litix's existing auto-refill worker acts on `Partial`; it does not by itself detect all drops after `Completed`.

## Important provider limits
SmmGlob's authenticated catalog at this time shows explicit 365-day options on Instagram, TikTok and YouTube. A supplier's named term is a *claim*, not an independently certified guarantee. Expose truthful protection terms on order details/terms, without needing a homepage promotional banner.

## No fabricated Git confirmation
No GitHub commit hash is included. Repository commit requires a code-write-capable connection to `LitGnosis/Litix` or running the included patch within the real checkout. Vercel's Git deployment connection can build existing commits but does not accept file edits to GitHub.

```

## scripts/apply-to-current-litix.mjs

```javascript
#!/usr/bin/env node
/**
 * Strict, additive patch for the actual latest Litix Next.js source checkout.
 * --check performs all replacements in memory without writing anything.
 * Fails closed if any validated source signature changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.cwd();
const appRoot = fs.existsSync(path.join(repo, 'src/lib/provider.js'))
  ? path.join(repo, 'src') : repo;
const pathFor = (name) => path.join(appRoot, name);
const targets = {
  provider: pathFor('lib/provider.js'),
  orders: pathFor('lib/orders.js'),
  services: pathFor('app/api/services/route.js')
};
const helperTarget = pathFor('lib/litixRefillPolicy.mjs');
const routeTarget = pathFor('app/api/internal/checkout-canary/route.js');
const patchSource = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(patchSource, '..');

for (const [key, target] of Object.entries(targets)) {
  if (!fs.existsSync(target)) throw new Error(`Complete current Litix source required (${key}): ${target}`);
}
const originals = Object.fromEntries(Object.entries(targets).map(([key, target]) => [key, fs.readFileSync(target, 'utf8')]));
const updates = { ...originals };
function replaceOnce(key, before, after) {
  const code = updates[key];
  const occurrences = code.split(before).length - 1;
  if (occurrences !== 1) throw new Error(`Source mismatch (${key}, count ${occurrences}): ${before.slice(0,65)}`);
  updates[key] = code.replace(before, after);
}
function replaceKnownCount(key, before, after, required) {
  const occurrences = updates[key].split(before).length - 1;
  if (occurrences !== required) throw new Error(`Source mismatch (${key}, expected ${required}, saw ${occurrences})`);
  updates[key] = updates[key].split(before).join(after);
}

replaceOnce('provider',
  "const ALLOWED_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X', 'Spotify', 'Telegram', 'Discord', 'Twitch', 'LinkedIn', 'Kick'];",
  "const ALLOWED_PLATFORMS = ['Instagram', 'TikTok', 'YouTube'];");
replaceOnce('provider', 'export function markupMultiplier() { return 15; }',
  'export function markupMultiplier() { return 8; }');

const refillMarker = "const refill = boolCapability(raw, 'refill', combined, /refill|drop protection/i, /refill\\s*:\\s*no|no\\s*refill|\\bNR\\b/i);";
replaceOnce('provider', refillMarker, refillMarker + `
  // Refill coverage MUST come from the live supplier flag and an explicit 365d-or-longer name.
  const refillTermDays = isEligibleSupplierService(raw, platform) ? 365 : 0;`);
replaceOnce('provider', 'refill, cancel, dripfeed,', 'refill: refillTermDays === 365, cancel, dripfeed,');
replaceOnce('provider', 'subscription: /subscription|auto/i.test(String(raw.type || combined)),',
  'refillTermDays, subscription: /subscription|auto/i.test(String(raw.type || combined)),');
replaceOnce('provider', 'const all = results.flat();',
  'const all = results.flat().filter(s => s.refillTermDays === 365);');
replaceOnce('provider', 'return raw ? normalizeService(raw, provider.id) : null;',
  'const resolved = raw ? normalizeService(raw, provider.id) : null; return resolved?.refillTermDays === 365 ? resolved : null;');
replaceOnce('provider', '"litix-supplier-catalog-retired-integrations-v1"',
  '"litix-instagram-tiktok-youtube-365day-refill-v4"');
if (updates.provider.includes('litixRefillPolicy.mjs')) throw new Error('Source already patched. Refusing duplicate import.');
updates.provider = `import { isEligibleSupplierService } from './litixRefillPolicy.mjs';\n` + updates.provider;

replaceOnce('orders', 'route.service.refill?new Date(Date.now()+30*86400000).toISOString():null',
  'route.service.refill?new Date(Date.now()+365*86400000).toISOString():null');
replaceOnce('orders', 'service.refill?new Date(Date.now()+30*86400000).toISOString():null',
  'service.refill?new Date(Date.now()+365*86400000).toISOString():null');
const createOrderHead = "export async function createOrder({id,service,target,quantity,providerCost:cost,providerCostUsd:costUsd,retailCents,email,paymentProvider='disabled',deliveryPlan={}}){";
replaceOnce('orders', createOrderHead, createOrderHead +
  "if(!service || service.refillTermDays!==365 || !['Instagram','TikTok','YouTube'].includes(service.platform))throw Error('Selected supplier service is not eligible for 365-day refill');");
replaceOnce('services', 'refill:s.refill,cancel:s.cancel',
  'refill:s.refill,refillTermDays:s.refillTermDays||0,cancel:s.cancel');

if (fs.existsSync(helperTarget) || fs.existsSync(routeTarget)) {
  throw new Error('Protection helper/route already exists; review before overwriting');
}
const additions = [
  [helperTarget, path.join(patchRoot, 'src/lib/litixRefillPolicy.mjs')],
  [routeTarget, path.join(patchRoot, 'src/app/api/internal/checkout-canary/route.js')]
];
for (const [, src] of additions) if (!fs.existsSync(src)) throw Error('Missing patch asset: ' + src);

if (process.argv.includes('--check')) {
  console.log('PASS: All current Litix source signatures matched; no files changed.');
  process.exit(0);
}
// Validate all edits before writing; no partial edit if source signatures drift.
const writes = [
  ...Object.entries(targets).map(([key, target]) => [target, updates[key]]),
  ...additions.map(([target, src]) => [target, fs.readFileSync(src, 'utf8')])
];
const backups = [];
const created = [];
try {
  for (const [target, content] of writes) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const backup = `${target}.litix-backup-${process.pid}`;
    if (fs.existsSync(target)) {
      fs.copyFileSync(target, backup);
      backups.push([backup, target]);
    }
    fs.writeFileSync(target, content);
    if (!backups.some(([,original])=>original===target)) created.push(target);
  }
  for (const [backup] of backups) fs.rmSync(backup, { force: true });
  console.log('PASS: Litix current source updated: 3 networks, 365-day-only supplier services, 8x custom prices.');
} catch (error) {
  for (const f of created) fs.rmSync(f, { force: true });
  for (const [backup, target] of backups) fs.copyFileSync(backup, target);
  for (const [backup] of backups) fs.rmSync(backup, { force: true });
  throw error;
}

```

## src/app/api/internal/checkout-canary/route.js

```javascript
/**
 * Preview-only, authenticated, NO-CHARGE smoke route.
 * Do not move this route to /api/checkout or call gateway/supplier write endpoints.
 */
import { NextResponse } from 'next/server';
import { getServiceById } from '../../../../lib/provider';
import { runMockCheckout } from '../../../../lib/litixRefillPolicy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const secret = process.env.LITIX_MOCK_TEST_SECRET;
  if (!secret || secret.length < 32 || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const input = await request.json();
    // This is an explicit supplier ID lookup, resolved against the live read-only catalog.
    const supplierId = String(input?.serviceId ?? '');
    if (!/^smmglob:\d{1,10}$/.test(supplierId)) {
      return NextResponse.json({ error: 'Expected SmmGlob supplier ID' }, { status: 400 });
    }
    const service = await getServiceById(supplierId);
    if (!service || service.refillTermDays !== 365) {
      return NextResponse.json({ error: 'Unavailable protected service' }, { status: 422 });
    }
    const quantity = Number(input?.quantity);
    const rawService = {
      service: service.providerServiceId,
      category: service.platform,
      name: `${service.name} [${service.refillTermDays} days refill]`, // derived only for the synthetic policy test
      refill: service.refill,
      rate: service.providerRateUsd,
      min: service.min,
      max: service.max
    };
    const result = runMockCheckout({
      rawService,
      network: service.platform,
      quantity,
      paymentToken: 'litix_mock_token_internal_9921'
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.warn('litix_mock_preflight_rejected', String(error?.message ?? 'invalid input').slice(0,130));
    return NextResponse.json({ error: 'Invalid mock checkout request' }, { status: 400 });
  }
}

```

## src/lib/litixRefillPolicy.mjs

```javascript
/**
 * Shared Litix custom-service policy.
 * SmmGlob catalog prices are quoted per 1,000 units in USD.
 * This module does not authorize supplier charges or real card transactions.
 */
export const SUPPORTED_NETWORKS = Object.freeze(['Instagram', 'TikTok', 'YouTube']);
export const CUSTOM_RETAIL_MULTIPLIER = 8;

export function isSupportedNetwork(network) {
  return SUPPORTED_NETWORKS.includes(String(network ?? ''));
}

export function hasYearOrLongerCoverage(name) {
  const description = String(name ?? '');
  return /(?:\b365\s*(?:days?|d)\b|\br\s*365\b|\b12\s*months\b|\b1\s*year\b|\blife\s*time\b|\blifetime\b)/i.test(description);
}

export function supplierHasRefill(raw) {
  return raw?.refill === true || raw?.refill === 1 ||
    String(raw?.refill ?? '').trim().toLowerCase() === 'true';
}

export function isEligibleSupplierService(raw, network) {
  if (!isSupportedNetwork(network) || !supplierHasRefill(raw)) return false;
  return hasYearOrLongerCoverage(`${raw?.category ?? ''} ${raw?.name ?? raw?.service_name ?? ''}`);
}

export function retailQuoteCents(wholesaleRateUsdPerThousand, quantity) {
  const rate = Number(wholesaleRateUsdPerThousand);
  const amount = Number(quantity);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError('Valid positive rate and whole quantity required');
  }
  const cents = Math.round((rate * amount / 1000) * CUSTOM_RETAIL_MULTIPLIER * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('Invalid retail price');
  return cents;
}

export function runMockCheckout({ rawService, network, quantity, paymentToken }) {
  if (!isEligibleSupplierService(rawService, network)) throw new Error('Service not 365-day-refill eligible');
  const min = Number(rawService.min);
  const max = Number(rawService.max);
  if (!Number.isSafeInteger(quantity) || quantity < min || quantity > max) {
    throw new RangeError('Quantity outside supplier limits');
  }
  // Only an internally generated synthetic token is accepted. No gateway call is made.
  if (paymentToken !== 'litix_mock_token_internal_9921') throw new Error('Invalid synthetic test token');
  const retailCents = retailQuoteCents(rawService.rate, quantity);
  return Object.freeze({
    success: true,
    mock: true,
    simulatedTokenizationCallback: true,
    network,
    supplierServiceId: String(rawService.service ?? rawService.id),
    quantity,
    retailCents,
    currency: 'USD',
    multiplier: CUSTOM_RETAIL_MULTIPLIER,
    supplierRefillTermDays: 365,
    gatewayNetworkCalled: false,
    cardCharged: false,
    paymentSettled: false,
    supplierNetworkCalled: false,
    supplierOrderPlaced: false,
    fulfillmentCompleted: false,
    note: 'Policy and state-transition simulation only; not a live gateway or supplier verification.'
  });
}

```

## tests/policy.test.mjs

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_NETWORKS,
  CUSTOM_RETAIL_MULTIPLIER,
  isSupportedNetwork,
  supplierHasRefill,
  hasYearOrLongerCoverage,
  isEligibleSupplierService,
  retailQuoteCents,
  runMockCheckout
} from '../src/lib/litixRefillPolicy.mjs';

const fixtures = {
  instagram: { service: 33556, category: 'Instagram Followers', name: 'IG Followers 365 Days Refill', refill: true, min: 30, max: 100000, rate: 1.4369 },
  tiktok: { service: 33395, category: 'TikTok Followers', name: 'TikTok Followers 365 Days Refill', refill: true, min: 10, max: 1000000, rate: 3.7525 },
  youtube: { service: 55704, category: 'YouTube Subscribers', name: 'YT Subscribe 365 Days Refill', refill: true, min: 100, max: 100000, rate: 54.4588 }
};

test('three and only three allowed networks', () => {
  assert.deepEqual(SUPPORTED_NETWORKS, ['Instagram', 'TikTok', 'YouTube']);
  for (const network of SUPPORTED_NETWORKS) assert.equal(isSupportedNetwork(network), true);
  for (const name of ['Facebook', 'X', 'Snapchat', 'Spotify', 'Telegram', 'Discord', 'LinkedIn', 'Kick']) {
    assert.equal(isSupportedNetwork(name), false, `${name} must be blocked`);
  }
});
test('coverage parsing requires >= 365 days, lifetime, or equivalent explicit label', () => {
  for (const label of ['365 Days Refill', '365d Refill', '[r365]', '1 year refill', '12 months refill', 'Lifetime Refill']) {
    assert.equal(hasYearOrLongerCoverage(label), true, label);
  }
  for (const label of ['30 Day Refill', '99 days refill', 'No Refill', 'Instant Likes', '364 days refill']) {
    assert.equal(hasYearOrLongerCoverage(label), false, label);
  }
});
test('supplier capability required separately from advertising label', () => {
  assert.equal(supplierHasRefill({ refill: false }), false);
  assert.equal(supplierHasRefill({ refill: true }), true);
  assert.equal(supplierHasRefill({ refill: 'true' }), true);
  assert.equal(isEligibleSupplierService({...fixtures.instagram, refill: false},'Instagram'), false);
  assert.equal(isEligibleSupplierService({...fixtures.instagram, name: '30 Day Refill'},'Instagram'), false);
  assert.equal(isEligibleSupplierService(fixtures.instagram,'Facebook'), false);
  for(const [key,platform] of [['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube']]) {
    assert.equal(isEligibleSupplierService(fixtures[key],platform), true,platform);
  }
});
test('custom pricing uses exact 8x multiplier on WHOLESALE per-1000 rate', () => {
  assert.equal(CUSTOM_RETAIL_MULTIPLIER, 8);
  assert.equal(retailQuoteCents(5,1000),4000);
  assert.equal(retailQuoteCents(1.4369,1000),1150);
  assert.equal(retailQuoteCents(3.7525,1000),3002);
  assert.equal(retailQuoteCents(54.4588,1000),43567);
  assert.equal(retailQuoteCents(4.37,1000),3496);
  assert.equal(retailQuoteCents(6.25,1000),5000);
});
test('invalid prices and quantities are rejected',()=>{
  for(const [rate,qty] of [[0,1000],[-5,1000],['foo',1000],[5,0],[5,1.5],[5,Number.MAX_SAFE_INTEGER]]){
    assert.throws(()=>retailQuoteCents(rate,qty), RangeError);
  }
});
test('complete local mock pipeline reports no real gateway or supplier activity',()=>{
  const result=runMockCheckout({rawService:fixtures.instagram,network:'Instagram',quantity:1000,paymentToken:'litix_mock_token_internal_9921'});
  assert.equal(result.success,true);
  assert.equal(result.mock,true);
  assert.equal(result.supplierServiceId,'33556');
  assert.equal(result.retailCents,1150);
  assert.equal(result.supplierRefillTermDays,365);
  for(const field of ['gatewayNetworkCalled','cardCharged','paymentSettled','supplierNetworkCalled','supplierOrderPlaced','fulfillmentCompleted']) {
    assert.equal(result[field],false,field);
  }
});
test('mock rejects malformed tokens, missing refill, unsupported networks, quantities',()=>{
  const base={rawService:fixtures.instagram,network:'Instagram',quantity:1000,paymentToken:'litix_mock_token_internal_9921'};
  assert.throws(()=>runMockCheckout({...base,paymentToken:'real-card-token'}));
  assert.throws(()=>runMockCheckout({...base,network:'X'}));
  assert.throws(()=>runMockCheckout({...base,quantity:10}));
  assert.throws(()=>runMockCheckout({...base,rawService:{...fixtures.instagram,refill:false}}));
});

```

## tests/source-patch.test.mjs

```javascript
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

```
