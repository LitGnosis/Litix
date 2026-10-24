import {monthlySandboxConfig} from '../../../../../../lib/monthly-gateway-config.mjs';
import {neon} from '@neondatabase/serverless';
import {customerAuth} from '../../../../../../lib/customer-auth';
import {verifiedCustomer} from '../../../../../../lib/customer-authorization.mjs';
import {sameOrigin} from '../../../../../../lib/customer-origin.mjs';
import {cancelRecurring} from '../../../../../../lib/nmi-recurring.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request,{params}){
 const send=(body,status)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 if(process.env.LITIX_MONTHLY_MANAGEMENT_ENABLED!=='true')return send({error:'Management unavailable'},503);
 if(!sameOrigin(request,process.env.APP_BASE_URL))return send({error:'Invalid origin'},403);
 const auth=customerAuth(),user=auth&&verifiedCustomer(await auth.getSession());if(!user)return send({error:'Verified login required'},401);
 let sandbox;try{sandbox=monthlySandboxConfig()}catch{return send({error:'Dedicated sandbox configuration required. No gateway request sent.'},503)}
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return send({error:'Not found'},404);
 if(!process.env.LITIX_MONTHLY_DATABASE_URL||!sandbox.securityKey)return send({error:'Management unavailable'},503);
 try{
 const sql=neon(process.env.LITIX_MONTHLY_DATABASE_URL);
 const rows=await sql.query('select provider_subscription_id,cancellation_state from litix_monthly_subscriptions where id=$1 and customer_subject=$2',[id,user.subject]);
 if(!rows.length)return send({error:'Not found'},404);const row=rows[0];
 if(row.cancellation_state==='confirmed')return send({cancellationState:'confirmed',message:'Future renewals stopped.'},200);
 const claim=await sql.query("update litix_monthly_subscriptions set cancellation_state='dispatching',cancellation_requested_at=now(),cancellation_attempted_at=now() where id=$1 and customer_subject=$2 and cancellation_state='none' returning id",[id,user.subject]);
 if(!claim.length)return send({cancellationState:'review',message:'Cancellation pending confirmation.'},202);
 const result=row.provider_subscription_id?await cancelRecurring({subscriptionId:row.provider_subscription_id,securityKey:sandbox.securityKey,endpoint:sandbox.endpoint}):{state:'review',code:'missing_provider_id'};
 const state=result.state==='renewal_stopped'?'confirmed':'review';
 await sql.query("update litix_monthly_subscriptions set cancellation_state=$2,cancellation_result_code=$3,cancellation_confirmed_at=case when $2='confirmed' then now() else null end where id=$1 and cancellation_state='dispatching'",[id,state,result.code||result.state]);
 return send({cancellationState:state,message:state==='confirmed'?'Future renewals stopped. Verified current coverage remains until its paid-through date.':'Cancellation outcome requires support reconciliation.'},state==='confirmed'?200:202);
 }catch{return send({error:'Cancellation not confirmed. Support reconciliation required.'},503)}
}
