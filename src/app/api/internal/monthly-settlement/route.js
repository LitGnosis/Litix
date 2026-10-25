import {timingSafeEqual} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {monthlySandboxConfig} from '../../../../lib/monthly-gateway-config.mjs';
import {runSettlementBatch} from '../../../../lib/monthly-settlement-worker.mjs';
import {queryMonthlyTransaction} from '../../../../lib/nmi-monthly-query.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request){
 const send=(value,status)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
 if(process.env.VERCEL_ENV!=='preview'||process.env.LITIX_MONTHLY_SETTLEMENT_ENABLED!=='true')return send({error:'Settlement worker disabled'},503);
 const secret=process.env.LITIX_MONTHLY_WORKER_SECRET,provided=request.headers.get('authorization')||'';
 if(!secret||secret.length<32)return send({error:'Worker configuration incomplete'},503);
 const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(provided);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return send({error:'Unauthorized'},401);
 try{
  const config=monthlySandboxConfig();if(!process.env.LITIX_MONTHLY_DATABASE_URL)throw Error('Storage unavailable');
  const sql=neon(process.env.LITIX_MONTHLY_DATABASE_URL);
  return send(await runSettlementBatch({sql,queryGateway:x=>queryMonthlyTransaction({...x,securityKey:config.securityKey,endpoint:config.queryEndpoint}),limit:3}),200);
 }catch{return send({error:'Settlement batch requires reconciliation'},503)}
}
