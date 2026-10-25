import {neon} from '@neondatabase/serverless';
import {customerAuth} from '../../../../../lib/customer-auth';
import {verifiedCustomer} from '../../../../../lib/customer-authorization.mjs';
import {customerReceipt} from '../../../../../lib/monthly-receipt.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request,{params}){
 const send=(body,status)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 const auth=customerAuth();if(!auth)return send({error:'Customer accounts unavailable'},503);
 const user=verifiedCustomer(await auth.getSession());if(!user)return send({error:'Verified login required'},401);
 if(!process.env.LITIX_MONTHLY_DATABASE_URL)return send({error:'Storage unavailable'},503);
 try{const {transactionId}=await params;const receipt=await customerReceipt(neon(process.env.LITIX_MONTHLY_DATABASE_URL),user.subject,transactionId);return receipt?send(receipt,200):send({error:'Receipt not found'},404)}catch{return send({error:'Receipt unavailable'},503)}
}
