import { request as httpsRequest } from 'node:https';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { SocksProxyAgent } from 'socks-proxy-agent';

type ProxyRecord = { id:string; ipAddress:string; port:number };
type Credential = { username?:string; password?:string };

const bound = (n:number, low:number, high:number) => Math.max(low,Math.min(high,n));
const maxLatency = 300;
const intervalMs = bound(Number(process.env.LITIX_PROXY_AUDIT_INTERVAL_MS || 30_000),15_000,900_000);
const timeoutMs = bound(Number(process.env.LITIX_PROXY_PROBE_TIMEOUT_MS || 2500),500,10_000);

function approvedProbe(): URL {
  const url = new URL(process.env.LITIX_OWNED_EGRESS_PROBE_URL || 'https://www.litix.net/api/fulfillment/health');
  if (url.protocol!=='https:' || !['litix.net','www.litix.net'].includes(url.hostname) ||
      url.pathname!=='/api/fulfillment/health' || url.username || url.password || url.port) {
    throw new Error('Egress probe must target the verified Litix-owned HTTPS health endpoint');
  }
  return url;
}

function credentials(): Record<string,Credential> {
  const value:unknown = JSON.parse(process.env.LITIX_PROXY_SECRET_MAP_JSON || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid proxy credential map');
  return value as Record<string,Credential>;
}

async function probe(proxy:ProxyRecord, secret:Credential, url:URL):Promise<number|null> {
  if (!/^[a-zA-Z0-9.:-]{1,253}$/.test(proxy.ipAddress) ||
    !Number.isInteger(proxy.port) || proxy.port<1 || proxy.port>65535) return null;
  const auth = secret.username ? `${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password || '')}@` : '';
  const proxyHost = proxy.ipAddress.includes(':') ? `[${proxy.ipAddress}]` : proxy.ipAddress;
  const agent = new SocksProxyAgent(`socks5h://${auth}${proxyHost}:${proxy.port}`);
  const target = new URL(url);
  target.searchParams.set('audit',Date.now().toString());
  const start=performance.now();
  return new Promise<number|null>((resolve)=>{
    let finished=false;
    const finish=(value:number|null)=>{if(finished)return;finished=true;resolve(value);};
    const request=httpsRequest(target,{
      method:'GET',agent,timeout:timeoutMs,
      headers:{'cache-control':'no-store','accept':'text/plain','user-agent':'LitixOwnedNetworkHealth/1.0'},
    },(response)=>{
      const healthy = response.statusCode===200 && response.headers['content-type']?.toString().startsWith('text/plain');
      let body='';
      response.setEncoding('utf8');
      response.on('data',(part:string)=>{body+=part;if(body.length>128)request.destroy();});
      response.on('end',()=>finish(healthy && body==='litix-owned-health-ok\n' ? Math.round(performance.now()-start):null));
      response.on('error',()=>finish(null));
    });
    request.on('timeout',()=>request.destroy(new Error('probe_timeout')));
    request.on('error',()=>finish(null));
    request.end();
  });
}

async function main() {
  if(process.env.LITIX_PROXY_AUDIT_ENABLED!=='true') throw new Error('Proxy audit is disabled');
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  const url=approvedProbe();
  const secretMap=credentials();
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:6000,
    application_name:'litix_owned_proxy_auditor'});
  let stopped=false;
  const stop=()=>{stopped=true;};
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  try {
    while(!stopped) {
      const rows=await pool.query<ProxyRecord>(
        `SELECT "id","ipAddress","port" FROM growth_ops."LitixMobileProxy" ORDER BY "id" LIMIT 250`,
      );
      for(const row of rows.rows) {
        if(stopped) break;
        const millis=await probe(row,secretMap[row.id] || {},url);
        const healthy=millis!==null && millis<=maxLatency;
        await pool.query(
          `UPDATE growth_ops."LitixMobileProxy"
             SET "latencyMs"=$2,"isCongested"=$3,"lastCheckedAt"=NOW()
           WHERE "id"=$1`,[row.id,millis===null?600000:millis,!healthy],
        );
        console.info('litix_owned_egress_audit',{probeId:row.id,healthy,latencyMs:millis});
      }
      if(!stopped) await sleep(intervalMs,undefined,{ref:true});
    }
  } finally {await pool.end();}
}

void main().catch((error)=>{
  console.error('litix_owned_egress_audit_stopped',{reason:error instanceof Error?error.name:'UNKNOWN'});
  process.exitCode=1;
});
