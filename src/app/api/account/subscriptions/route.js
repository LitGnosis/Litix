import {monthlySandboxConfig} from '../../../../lib/monthly-gateway-config.mjs';
import {neon} from '@neondatabase/serverless';
import {customerAuth} from '../../../../lib/customer-auth';
import {verifiedCustomer} from '../../../../lib/customer-authorization.mjs';
import {sameOrigin} from '../../../../lib/customer-origin.mjs';
import {createMonthly} from '../../../../lib/monthly-lifecycle.mjs';
import {monthlyRepository} from '../../../../lib/monthly-repository.mjs';
import {createNmiMonthly} from '../../../../lib/nmi-monthly-create.mjs';
import {sendManagementEmail} from '../../../../lib/monthly-mailer.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request){
 const send=(body,status)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 // No automatic production enablement. Merchant approval and real integration tests precede this flag.
 if(process.env.LITIX_MONTHLY_PURCHASE_ENABLED!=='true')return send({error:'Monthly purchasing is disabled. No charge submitted.'},503);
 if(!sameOrigin(request,process.env.APP_BASE_URL))return send({error:'Invalid request origin'},403);
 const auth=customerAuth();const user=auth&&verifiedCustomer(await auth.getSession());if(!user)return send({error:'Verified customer login required'},401);
 let sandbox;try{sandbox=monthlySandboxConfig()}catch{return send({error:'Dedicated sandbox configuration required. No gateway request sent.'},503)}
 const connection=process.env.LITIX_MONTHLY_DATABASE_URL,key=sandbox.securityKey,apiKey=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM,startDate=process.env.LITIX_MONTHLY_APPROVED_START_DATE;
 if(!connection||!key||!apiKey||!from||!startDate)return send({error:'Monthly integration configuration incomplete. No charge submitted.'},503);
 let input;try{const raw=await request.text();if(raw.length>4096)return send({error:'Request too large'},413);input=JSON.parse(raw)}catch{return send({error:'Invalid JSON'},400)}
 // Identity always derives from verified server session, never submitted customer ID/email.
 try{
 const sql=neon(connection),repository=monthlyRepository(sql);
 await sql.query('insert into litix_customers(subject,verified_email) values($1,$2) on conflict(subject) do update set verified_email=$2,updated_at=now()',[user.subject,user.email]);
 const result=await createMonthly({input:{...input,email:user.email,customerSubject:user.subject},repository,gateway:{create:x=>createNmiMonthly({...x,startDate,securityKey:key,endpoint:sandbox.endpoint})},mailer:{sendManagement:x=>sendManagementEmail({...x,apiKey,from})}});
 return send(result,202);
 }catch{return send({error:'Subscription could not be confirmed. Do not retry with a new payment key; contact support for reconciliation.'},503)}
}
