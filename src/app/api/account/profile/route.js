import {customerAuth} from '../../../../lib/customer-auth';
import {customerIdentity} from '../../../../lib/customer-policy.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 const send=(body,status)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 const auth=customerAuth();if(!auth)return send({error:'Login unavailable'},503);
 const identity=customerIdentity(await auth.getSession());if(!identity)return send({error:'Sign in required'},401);
 if(!identity.verified)return send({error:'Verified email required'},403);
 // Return only the current server-session identity. No request-provided subject.
 return send({email:identity.email,emailVerified:true},200);
}
