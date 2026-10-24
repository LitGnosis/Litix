import {monthlySandboxConfig} from '../../../../../lib/monthly-gateway-config.mjs';
import {neon} from '@neondatabase/serverless';
import {bearer,manageSubscription} from '../../../../../lib/subscription-management.mjs';
import {cancelRecurring} from '../../../../../lib/nmi-recurring.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const send=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
async function handle(request,cancel){
 // Intentionally no activation via existing live key alone. Schema and integration must be approved first.
 if(process.env.LITIX_MONTHLY_MANAGEMENT_ENABLED!=='true')return send({error:'Subscription management is not enabled. No gateway request was sent.'},503);
 const token=bearer(request.headers);if(!token)return send({error:'Private management authorization required.'},401);
 let sandbox;try{sandbox=monthlySandboxConfig()}catch{return send({error:'Dedicated sandbox configuration required. No gateway request sent.'},503)}
 const connection=process.env.LITIX_MONTHLY_DATABASE_URL;
 const key=sandbox.securityKey;
 if(!connection||!key)return send({error:'Subscription management configuration is incomplete.'},503);
 const sql=neon(connection);
 const repository={
  find:async hash=>(await sql.query('select * from litix_monthly_subscriptions where management_token_hash=$1 and management_token_expires_at>now()',[hash]))[0],
  claim:async id=>(await sql.query("update litix_monthly_subscriptions set cancellation_state='dispatching',cancellation_requested_at=coalesce(cancellation_requested_at,now()),cancellation_attempted_at=now(),updated_at=now() where id=$1 and cancellation_state='none' returning *",[id]))[0],
  finish:async(id,state,code)=>sql.query("update litix_monthly_subscriptions set cancellation_state=$2,cancellation_result_code=$3,cancellation_confirmed_at=case when $2='confirmed' then now() else null end,updated_at=now() where id=$1 and cancellation_state='dispatching'",[id,state,code])
 };
 try{const result=await manageSubscription({token,cancel,repository,gateway:subscriptionId=>cancelRecurring({subscriptionId,securityKey:key,endpoint:sandbox.endpoint})});return send(result.body,result.status)}catch{return send({error:'Management outcome requires review. Do not assume cancellation succeeded.'},503)}
}
export function GET(request){return handle(request,false)}
export function POST(request){return handle(request,true)}
