import {neon} from "@neondatabase/serverless";
import {creatorHash,creatorDbUrl} from "../../../../lib/creatorFunnel.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const redirect=status=>{
 const url=new URL("https://www.litix.net/growth");
 url.searchParams.set("signup",status);
 return Response.redirect(url,303);
};
export async function GET(req){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return redirect("invalid");
 const dbUrl=creatorDbUrl();
 if(!dbUrl)return redirect("unavailable");
 try{
  const sql=neon(dbUrl);
  const confirmed=await sql.query(
   "update public.litix_creator_signups set status='confirmed',confirmed_at=now(),confirm_hash=null,confirm_expires_at=null,updated_at=now() where status='pending' and confirm_hash=$1 and confirm_expires_at>now() returning id",
   [creatorHash(token)]);
  return redirect(confirmed.length?"confirmed":"expired");
 }catch{return redirect("unavailable")}
}
