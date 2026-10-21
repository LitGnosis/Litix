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
