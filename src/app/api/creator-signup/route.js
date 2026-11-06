import {neon} from "@neondatabase/serverless";
import {randomBytes} from "node:crypto";
import {creatorSignupInput,creatorHash,creatorDbUrl} from "../../../lib/creatorFunnel.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
const json=(value,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const message={ok:true,message:"If eligible, a confirmation email will arrive shortly. No purchase was made."};
export async function POST(req){
 const origin=req.headers.get("origin");
 const own=new URL(req.url).origin;
 if(!origin||![own,"https://www.litix.net","https://litix.net"].includes(origin))return json({error:"Unsupported origin"},403);
 if(!/^application\/json\b/i.test(req.headers.get("content-type")||""))return json({error:"Expected JSON"},415);
 if(Number(req.headers.get("content-length")||0)>4096)return json({error:"Request too large"},413);
 let raw;
 try{const data=await req.text();if(data.length>4096)return json({error:"Request too large"},413);raw=JSON.parse(data)}
 catch{return json({error:"Invalid request"},400)}
 const checked=creatorSignupInput(raw);
 if(checked.spam)return json(message);
 if(!checked.ok)return json({error:checked.error},400);
 if(process.env.LITIX_CREATOR_SIGNUP_ENABLED!=="true")return json({error:"Signups are temporarily unavailable"},503);
 const database=creatorDbUrl();
 const resendKey=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!database||!resendKey)return json({error:"Signups are temporarily unavailable"},503);
 const sql=neon(database);
 const {email,attribution}=checked.data;
 const token=randomBytes(32).toString("hex"),digest=creatorHash(token);
 try{
  let affiliate=null;
  if(/^[a-f0-9]{24}$/.test(attribution.ref||"")){
   const result=await sql.query("select code from public.litix_affiliate_partners where code=$1 and active=true limit 1",[attribution.ref]);
   affiliate=result[0]?.code||null;
  }
  const claimed=await sql.query(
   "insert into public.litix_creator_signups(email,confirm_hash,confirm_expires_at,utm_source,utm_medium,utm_campaign,utm_content,affiliate_code) values($1,$2,now()+interval '24 hours',$3,$4,$5,$6,$7) on conflict(email) do update set confirm_hash=excluded.confirm_hash,confirm_expires_at=excluded.confirm_expires_at,utm_source=excluded.utm_source,utm_medium=excluded.utm_medium,utm_campaign=excluded.utm_campaign,utm_content=excluded.utm_content,affiliate_code=excluded.affiliate_code,last_email_sent_at=now(),updated_at=now() where litix_creator_signups.status='pending' and litix_creator_signups.last_email_sent_at < now()-interval '12 hours' returning id",
   [email,digest,attribution.utm_source||null,attribution.utm_medium||null,attribution.utm_campaign||null,attribution.utm_content||null,affiliate]);
  if(!claimed.length)return json(message);
  const link="https://www.litix.net/api/creator-signup/confirm?token="+token;
  const result=await fetch("https://api.resend.com/emails",{
   method:"POST",cache:"no-store",signal:AbortSignal.timeout(8500),
   headers:{"authorization":"Bearer "+resendKey,"content-type":"application/json","Idempotency-Key":"litix-creator-confirm-"+digest.slice(0,48)},
   body:JSON.stringify({from:"Litix <orders@litix.net>",to:[email],subject:"Confirm your Litix creator planner link",
    text:"You requested a link to the free Litix Growth OS Content Calendar.\n\nConfirm your request: "+link+
    "\n\nThis confirmation expires after 24 hours. If you did not request it, ignore this email. No purchase, recurring messaging, or account was created."})
  });
  if(!result.ok)throw Error("resend_rejected");
  return json(message);
 }catch{
  // A failed email delivery must not leave the per-email cooldown permanently locked.
  await sql.query("update public.litix_creator_signups set last_email_sent_at=now()-interval '13 hours' where email=$1 and status='pending' and confirm_hash=$2",[email,digest]).catch(()=>{});
  return json({error:"Unable to send the confirmation right now"},503);
 }
}
