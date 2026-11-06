import {neon} from "@neondatabase/serverless";
import {creatorDbUrl} from "../../../lib/creatorFunnel.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const notFound=()=>Response.json({error:"Unknown referral"},{status:404,headers:{"cache-control":"no-store"}});
export async function GET(_req,context){
 const params=await context.params;
 const code=String(params?.code||"");
 if(!/^[a-f0-9]{24}$/.test(code))return notFound();
 const dbUrl=creatorDbUrl();
 if(!dbUrl)return notFound();
 try{
  const sql=neon(dbUrl);
  const partner=await sql.query("update public.litix_affiliate_partners set click_count=click_count+1 where code=$1 and active=true returning code",[code]);
  if(!partner.length)return notFound();
  // Explicit URL source tags: no hidden cookie, tracking pixel or verified sale claim.
  const url=new URL("https://www.litix.net/");
  url.searchParams.set("ref",code);
  url.searchParams.set("utm_source","affiliate");
  url.searchParams.set("utm_medium","referral");
  url.searchParams.set("utm_campaign","creator_plan");
  url.hash="growth-studio";
  return Response.redirect(url,302);
 }catch{return notFound()}
}
