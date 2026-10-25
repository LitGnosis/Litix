import { neon } from "@neondatabase/serverless";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const send=(x,code=200)=>Response.json(x,{status:code,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const connection=()=>process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRES_PRISMA_URL;
export async function GET(){
  if(!customerAuthConfigured())return send({error:"Customer accounts are not enabled."},503);
  const user=await authenticatedCustomer();
  if(!user)return send({error:"Sign in with a verified email to access your orders."},401);
  if(!connection())return send({error:"Dashboard storage is unavailable."},503);
  try{
    const sql=neon(connection());
    const orders=await sql.query("select id,service_name,quantity,amount_cents,payment_state,fulfillment_state,created_at from litix_v2_orders where lower(email)=$1 order by created_at desc limit 30",[user.email]);
    return send({account:{name:user.name,email:user.email},orders:orders.map(o=>({id:o.id,service:o.service_name,quantity:o.quantity,amount:"USD "+(Number(o.amount_cents)/100).toFixed(2),payment:o.payment_state,fulfillment:o.fulfillment_state,createdAt:o.created_at})),campaigns:[],autoLikes:{available:false,reason:"Recurring billing is not enabled."}});
  }catch(e){console.error("Litix account lookup failed",String(e?.message||"error").slice(0,90));return send({error:"Customer dashboard is temporarily unavailable."},503)}
}
