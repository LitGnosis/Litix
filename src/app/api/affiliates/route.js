import {neon} from "@neondatabase/serverless";
import {randomBytes} from "node:crypto";
import {creatorDbUrl,ownerTokenAuthorized} from "../../../lib/creatorFunnel.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const authorized=req=>ownerTokenAuthorized(req,process.env.LITIX_GROWTH_ADMIN_TOKEN||process.env.LITIX_GUARDIAN_ADMIN_TOKEN||process.env.ADMIN_SECRET);
function ownerDb(req){
 if(!authorized(req))return null;
 const url=creatorDbUrl();return url?neon(url):null;
}
export async function GET(req){
 const sql=ownerDb(req);
 if(!sql)return respond({error:"Unauthorized or unavailable"},401);
 try{
  const rows=await sql.query(
   "select p.code,p.label,p.active,p.click_count,p.created_at,p.approved_at,count(l.id)::int as confirmed_signups from public.litix_affiliate_partners p left join public.litix_creator_signups l on l.affiliate_code=p.code and l.status='confirmed' group by p.code order by p.created_at desc limit 100");
  return respond({partners:rows,attribution:"lead_signups_only",paidSalesAttributionVerified:false,payoutsEnabled:false});
 }catch{return respond({error:"Affiliate records unavailable"},503)}
}
export async function POST(req){
 const sql=ownerDb(req);
 if(!sql)return respond({error:"Unauthorized or unavailable"},401);
 if(!/^application\/json\b/i.test(req.headers.get("content-type")||""))return respond({error:"Expected JSON"},415);
 let raw;try{const value=await req.text();if(value.length>2048)return respond({error:"Too large"},413);raw=JSON.parse(value)}catch{return respond({error:"Invalid request"},400)}
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return respond({error:"Invalid request"},400);
 try{
  if(raw.action==="create"){
   const label=typeof raw.label==="string"?raw.label.trim():"";
   if(!/^[a-z0-9][a-z0-9 ._-]{2,99}$/i.test(label))return respond({error:"Invalid partner label"},400);
   const code=randomBytes(12).toString("hex");
   const inserted=await sql.query("insert into public.litix_affiliate_partners(code,label,active) values($1,$2,false) returning code,label,active",[code,label]);
   return respond({partner:inserted[0],link:"https://www.litix.net/r/"+code,needsApproval:true,paidPayoutsEnabled:false},201);
  }
  if(raw.action==="activate"||raw.action==="deactivate"){
   const code=String(raw.code||"");
   if(!/^[a-f0-9]{24}$/.test(code))return respond({error:"Invalid code"},400);
   const active=raw.action==="activate";
   const rows=await sql.query("update public.litix_affiliate_partners set active=$2,approved_at=case when $2 then now() else approved_at end where code=$1 returning code,label,active",[code,active]);
   return rows.length?respond({partner:rows[0],paidPayoutsEnabled:false}):respond({error:"Unknown partner"},404);
  }
  return respond({error:"Unsupported action"},400);
 }catch{return respond({error:"Affiliate update failed"},503)}
}
