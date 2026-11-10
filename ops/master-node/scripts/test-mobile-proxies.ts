import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { pool } from '../lib/infrastructure/pg';

type ProxyRow = {
  id: string;
  ipAddress: string;
  port: number;
  ispCarrier: string;
};

type ProxyCredentials = Record<string, { username?: string; password?: string }>;

const TIMEOUT_MS = 5_000;
const SLOW_MS = 300;
const MAX_PARALLEL = 4;

function loadCredentials(): ProxyCredentials {
  const input = process.env.LITIX_PROXY_CREDENTIALS_JSON;
  if (!input) throw new Error('LITIX_PROXY_CREDENTIALS_JSON is required in secret manager');
  const parsed: unknown = JSON.parse(input);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid credentials map');
  const result = parsed as ProxyCredentials;
  for (const value of Object.values(result)) {
    if (!value || typeof value !== 'object' ||
      (value.username !== undefined && typeof value.username !== 'string') ||
      (value.password !== undefined && typeof value.password !== 'string')) {
      throw new Error('invalid proxy credentials record');
    }
  }
  return result;
}

function probeTarget(): URL {
  const configured = process.env.OWNED_EGRESS_HEALTH_URL;
  if (!configured) throw new Error('OWNED_EGRESS_HEALTH_URL is required');
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
    !['litix.net', 'www.litix.net'].includes(url.hostname.toLowerCase())) {
    throw new Error('health URL must be an owned Litix HTTPS endpoint');
  }
  return url;
}

async function probe(proxy: ProxyRow, creds: ProxyCredentials, destination: URL): Promise<{ ms: number; ok: boolean }> {
  if (!Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535) return { ms: 0, ok: false };
  const url = new URL(`socks5h://${proxy.ipAddress}:${proxy.port}`);
  const user = creds[proxy.id];
  if (!user) return { ms: 0, ok: false };
  url.username = user.username ?? '';
  url.password = user.password ?? '';
  const start = performance.now();
  const responseCode = await new Promise<number>((resolve) => {
    const req = https.get(destination, {
      agent: new SocksProxyAgent(url),
      timeout: TIMEOUT_MS,
      headers: { 'user-agent': 'Litix-Authorized-Egress-Audit/1.0', accept: 'text/plain' },
    }, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    req.once('timeout', () => req.destroy(new Error('timeout')));
    req.once('error', () => resolve(0));
  });
  const ms = Math.max(1, Math.round(performance.now() - start));
  return { ms, ok: responseCode === 200 && ms <= SLOW_MS };
}

async function main(): Promise<void> {
  const credentials = loadCredentials();
  const destination = probeTarget();
  const lock = await pool.connect();
  let hasLock = false;
  try {
    const acquired = await lock.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock(846032091) AS locked`,
    );
    if (!acquired.rows[0]?.locked) {
      process.stdout.write(JSON.stringify({ runningElsewhere: true }) + '\n');
      return;
    }
    hasLock = true;
    const inventory = await pool.query<ProxyRow>(
      `SELECT "id", "ipAddress", "port", "ispCarrier"
       FROM growth_ops."LitixProxyPool" ORDER BY "id"`,
    );
    const queue = [...inventory.rows];
    let checked = 0;
    let congested = 0;
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, async () => {
      for (;;) {
        const proxy = queue.shift();
        if (!proxy) break;
        let result: { ms: number; ok: boolean };
        try {
          result = await probe(proxy, credentials, destination);
        } catch {
          result = { ms: 0, ok: false };
        }
        await pool.query(
          `UPDATE growth_ops."LitixProxyPool"
           SET "latencyMs"=$2,"isCongested"=$3,"lastCheckedAt"=NOW()
           WHERE "id"=$1`,
          [proxy.id, result.ms, !result.ok],
        );
        checked += 1;
        if (!result.ok) congested += 1;
      }
    });
    await Promise.all(workers);
    process.stdout.write(JSON.stringify({ checked, congested, healthy: checked - congested, thresholdMs: SLOW_MS }) + '\n');
  } finally {
    if (hasLock) await lock.query('SELECT pg_advisory_unlock(846032091)').catch(() => {});
    lock.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error('owned_proxy_audit_failed', error instanceof Error ? error.name : 'unknown');
  process.exitCode = 1;
});