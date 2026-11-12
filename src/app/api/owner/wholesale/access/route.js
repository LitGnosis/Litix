import {NextResponse} from "next/server";
import {OWNER_SESSION,OWNER_CHALLENGE,COOKIE_OPTIONS,ownerDB,ownerEmail,
 issueCode,hashCode,seal,ownerChallenge,authenticatedOwner,ownerPostOrigin,
 ownerHeaders,ownerOrigin} from "../../../../../lib/litixOwnerWholesaleAuth.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:ownerHeaders});
export async function GET(request){
 if(!ownerOrigin(request))return reply({authenticated:false},403);
 // Boolean readiness only; never expose the private owner address or keys.
 let ready=false;
 try{
  ownerEmail();seal("readiness",{ok:true});
  ready=!!(process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY)&&
   !!(process.env.LITIX_BOOSTERO_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL);
 }catch{}
 return reply({authenticated:!!authenticatedOwner(request),ready});
}
export async function POST(request){
 if(!ownerPostOrigin(request))return reply({error:"same_origin_required"},403);
 if(Number(request.headers.get("content-length")||0)>1200)return reply({error:"request_too_large"},413);
 let input;try{input=await request.json()}catch{return reply({error:"invalid_json"},400)}
 const action=String(input?.action||"");
 if(action==="logout"){
  const res=reply({authenticated:false});
  res.cookies.set(OWNER_SESSION,"",{...COOKIE_OPTIONS,maxAge:0});
  res.cookies.set(OWNER_CHALLENGE,"",{...COOKIE_OPTIONS,maxAge:0});
  return res;
 }
 if(action==="request_code"){
  try{
   if(authenticatedOwner(request))return reply({authenticated:true});
   const to=ownerEmail(),key=String(process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY||"");
   if(!key)throw Error("email_unavailable");
   const db=ownerDB(),{id,code,expiresAt}=issueCode();
   // Limit anonymous email requests; neither address nor code reaches client.
   const inserted=await db.query(
    "INSERT INTO public.litix_owner_access_challenges(id,code_hash,expires_at) SELECT $1::uuid,$2,$3::timestamptz WHERE (SELECT COUNT(*) FROM public.litix_owner_access_challenges WHERE created_at>now()-interval '1 hour')<3 RETURNING id",
    [id,hashCode(id,code),expiresAt.toISOString()]);
   if(inserted.length!==1)return reply({error:"Too many access requests. Try again later."},429);
   const response=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"authorization":"Bearer "+key,
      "content-type":"application/json","Idempotency-Key":"litix-owner-wholesale-otp/"+id},
    body:JSON.stringify({from:"Litix <orders@litix.net>",to:[to],
      subject:"Your Litix owner wholesale sign-in code",
      text:"Your Litix private wholesale access code is "+code+
       ". It expires in 10 minutes. Enter it only on www.litix.net/owner/wholesale. If you did not request this code, ignore this email."}),
    redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000)
   });
   if(!response.ok){
    await db.query("UPDATE public.litix_owner_access_challenges SET used_at=now() WHERE id=$1",[id]).catch(()=>{});
    throw Error("email_unavailable");
   }
   const result=reply({codeSent:true,expiresMinutes:10});
   result.cookies.set(OWNER_CHALLENGE,seal("challenge",{id,expires:expiresAt.getTime()}),
    {...COOKIE_OPTIONS,maxAge:600});
   return result;
  }catch{return reply({error:"Owner sign-in email could not be sent. No purchase was attempted."},503)}
 }
 if(action==="verify_code"){
  const challenge=ownerChallenge(request),code=String(input?.code||"");
  if(!challenge||!/^[0-9]{8}$/.test(code))return reply({error:"Invalid or expired code"},401);
  try{
   const db=ownerDB();
   const accepted=await db.query(
    "UPDATE public.litix_owner_access_challenges SET used_at=now(), attempts=attempts+1 WHERE id=$1::uuid AND code_hash=$2 AND used_at IS NULL AND expires_at>now() AND attempts<5 RETURNING id",
    [challenge.id,hashCode(challenge.id,code)]);
   if(accepted.length!==1){
    await db.query("UPDATE public.litix_owner_access_challenges SET attempts=attempts+1 WHERE id=$1::uuid AND used_at IS NULL AND expires_at>now() AND attempts<5",[challenge.id]).catch(()=>{});
    return reply({error:"Invalid or expired code"},401);
   }
   const now=Math.floor(Date.now()/1000);
   const res=reply({authenticated:true});
   res.cookies.set(OWNER_SESSION,seal("session",{kind:"wholesale",iat:now,exp:now+3600}),
    {...COOKIE_OPTIONS,maxAge:3600});
   res.cookies.set(OWNER_CHALLENGE,"",{...COOKIE_OPTIONS,maxAge:0});
   return res;
  }catch{return reply({error:"Owner verification temporarily unavailable"},503)}
 }
 return reply({error:"unsupported_action"},400);
}
