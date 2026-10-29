import {timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {boosteroReadOnly} from "../../../../../lib/boosteroReadOnly.mjs";
import {importBoosteroInventory} from "../../../../../lib/boosteroInventorySync.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
const reply=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-robots-tag":"noindex","x-content-type-options":"nosniff"}});
function authorized(req){
 const given=String(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 const expected=String(process.env.LITIX_CATALOG_IMPORT_TOKEN||"");
 return expected.length>=48&&given.length===expected.length&&timingSafeEqual(Buffer.from(given),Buffer.from(expected));
}
/** Strictly PREVIEW-only. Import into separate staging Neon project, never active production DB. */
export async function POST(req){
 if(process.env.VERCEL_ENV!=="preview")return reply({error:"not_found"},404);
 if(!authorized(req))return reply({error:"unauthorized"},401);
 const uri=String(process.env.LITIX_INVENTORY_STAGING_DATABASE_URL||"");
 const expected=String(process.env.LITIX_INVENTORY_STAGING_EXPECTED_HOST||"");
 let parsed;
 try{parsed=new URL(uri)}catch{return reply({error:"staging_not_configured"},503)}
 if(parsed.protocol!=="postgresql:"||parsed.hostname!==expected||!expected.endsWith(".neon.tech")||
    parsed.pathname!=="/neondb"||!parsed.username||!parsed.password)
  return reply({error:"staging_database_host_not_allowlisted"},503);
 try{
  const raw=await boosteroReadOnly("services");
  const sql=neon(uri);
  const result=await importBoosteroInventory(sql,raw,{force:true});
  const rows=await sql.query("select count(*)::integer as total,count(*) filter (where active)::integer as active,count(*) filter (where standard_input_compatible and active)::integer as input_candidates from public.litix_boostero_inventory");
  return reply({ok:true,source:"boostero_api_v2",environment:"isolated_staging",...result,db:rows[0]||{}});
 }catch(e){
  const code=String(e?.message||"");
  const kind=/^inventory_[a-z0-9_]+$/.test(code)?code:"staging_import_failed";
  console.error("boostero_staging_inventory_failed",kind);
  return reply({ok:false,error:kind},503);
 }
}
export async function GET(){return reply({error:"method_not_allowed"},405)}
