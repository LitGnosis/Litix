import {neon} from "@neondatabase/serverless";
import {ownerTokenAuthorized,creatorDbUrl} from "../../../../lib/creatorFunnel.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req){
 const secret=process.env.LITIX_GROWTH_ADMIN_TOKEN||process.env.LITIX_GUARDIAN_ADMIN_TOKEN||process.env.ADMIN_SECRET;
 if(!ownerTokenAuthorized(req,secret))return Response.json({error:"Owner authorization required"},{status:401,headers:{"cache-control":"no-store"}});
 const url=creatorDbUrl();
 if(!url)return Response.json({error:"Growth reporting unavailable"},{status:503});
 try{
  const sql=neon(url);
  const rows=await sql.query(
   "select coalesce(utm_source,'direct_or_unknown') as source,coalesce(utm_campaign,'none') as campaign,count(*)::int as requests,count(*) filter(where status='confirmed')::int as confirmed from public.litix_creator_signups where created_at>=now()-interval '30 days' group by 1,2 order by requests desc limit 50");
  return Response.json({rangeDays:30,sourceCoverage:"first_party_client_supplied",salesAttribution:false,leads:rows},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch{return Response.json({error:"Growth reporting unavailable"},{status:503})}
}
