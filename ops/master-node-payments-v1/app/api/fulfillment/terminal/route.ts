import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { isVerifiedOwnerRequest } from '../../../../lib/ops/terminal-auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Row = {id:string;isOnline:boolean;activeOrderId:string|null;cpuLoadPercent:number;
  updatedAt:Date;ispCarrier:string|null;isCongested:boolean|null;latencyMs:number|null;lastCheckedAt:Date|null};

const respond=(payload:unknown,status=200)=>NextResponse.json(payload,{status,
  headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function GET(req:Request) {
  if(process.env.LITIX_OPS_TERMINAL_ENABLED!=='true')return respond({error:'not_enabled'},404);
  if(!isVerifiedOwnerRequest(req))return respond({error:'unauthorized'},401);
  if(!process.env.DATABASE_URL)return respond({error:'unavailable'},503);
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,
    connectionTimeoutMillis:4000,application_name:'litix_owner_ops_terminal'});
  try {
    const r=await pool.query<Row>(`SELECT n."id",n."isOnline",n."activeOrderId",n."cpuLoadPercent",n."updatedAt",
      p."ispCarrier",p."isCongested",p."latencyMs",p."lastCheckedAt"
      FROM growth_ops."LitixHardwareNode" n
      LEFT JOIN growth_ops."LitixMobileProxy" p ON p."id"=n."proxyId"
      ORDER BY n."updatedAt" DESC LIMIT 30`);
    const now=Date.now();
    const nodes=r.rows.map(row=>{
      const heartbeatFresh=now-new Date(row.updatedAt).getTime()<90_000;
      const sampleFresh=row.lastCheckedAt && now-new Date(row.lastCheckedAt).getTime()<300_000;
      return {
        id:'LITIX-'+createHash('sha256').update(row.id).digest('hex').slice(0,10).toUpperCase(),
        state:row.isOnline && heartbeatFresh ? (row.activeOrderId?'busy':'idle'):'offline',
        cpuPercent:Number.isFinite(Number(row.cpuLoadPercent))?Math.max(0,Math.min(100,Number(row.cpuLoadPercent))):null,
        reportedCarrier:row.ispCarrier || null,
        networkHealthy:Boolean(sampleFresh && row.isCongested===false && row.latencyMs!==null),
        networkLatencyMs:sampleFresh && row.latencyMs!==null ? Number(row.latencyMs):null,
        heartbeatAt:new Date(row.updatedAt).toISOString(),
      };
    });
    return respond({asOf:new Date().toISOString(),source:'verified_database_snapshot',
      onlineNodes:nodes.filter(n=>n.state!=='offline').length,
      activeNodes:nodes.filter(n=>n.state==='busy').length,nodes,
      note:'Owner-only operational status. Carrier names are operator-declared; latency is an owned-endpoint network probe, not service delivery.'});
  } catch {
    return respond({error:'telemetry_unavailable'},503);
  } finally {await pool.end();}
}
