import {neon} from '@neondatabase/serverless';
import {customerAuth} from '../../../../lib/customer-auth';
import {verifiedCustomer,customerRecords} from '../../../../lib/customer-authorization.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 const send=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 const auth=customerAuth();if(!auth)return send({error:'Customer accounts unavailable'},503);
 const session=await auth.getSession();if(!session)return send({error:'Sign in required'},401);
 const user=verifiedCustomer(session);if(!user)return send({error:'Verify your email before accessing customer records.'},403);
 if(!process.env.LITIX_MONTHLY_DATABASE_URL)return send({error:'Customer storage is not connected'},503);
 try{const sql=neon(process.env.LITIX_MONTHLY_DATABASE_URL);return send(await customerRecords(sql,user.subject))}catch{return send({error:'Customer records temporarily unavailable'},503)}
}
