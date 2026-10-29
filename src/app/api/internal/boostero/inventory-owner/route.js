import {boosteroAdminAuthorized,boosteroSQL} from "../../../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const reply=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex"}});
/** Owner-authorized inventory review only. Supplier wholesale never goes public. */
export async function GET(request){
 if(process.env.VERCEL_ENV!=="production")return reply({error:"not_found"},404);
 if(!boosteroAdminAuthorized(request.headers.get("authorization")))return reply({error:"unauthorized"},401);
 if(process.env.LITIX_BOOSTERO_GLOBAL_SYNC_ENABLED!=="true")
  return reply({error:"inventory_not_enabled_or_migrated"},503);
 const params=new URL(request.url).searchParams;
 const page=Math.max(1,Math.min(100000,Number.parseInt(params.get("page")||"1",10)||1));
 const platform=String(params.get("platform")||"").slice(0,80);
 const q=String(params.get("q")||"").slice(0,100);
 const status=String(params.get("status")||"all");
 if(!["all","active","inactive","needs_implementation"].includes(status))return reply({error:"invalid_status"},400);
 try{
  const sql=boosteroSQL();
  const groups=await sql.query(
   "select platform, count(*)::integer as total, count(*) filter(where active)::integer as active, count(*) filter(where standard_input_compatible and active)::integer as input_candidates from public.litix_boostero_inventory group by platform order by case when platform='Instagram' then 0 when platform='TikTok' then 1 else 2 end,platform"
  );
  const sync=await sql.query("select executed_at,retrieved_count,valid_count,invalid_count from public.litix_boostero_inventory_syncs where result='success' order by id desc limit 1");
  const where=`where ($1::text='' or platform=$1) and ($2::text='' or service_name ilike '%'||$2||'%' or supplier_category ilike '%'||$2||'%')
    and ($3::text='all' or ($3='active' and active) or ($3='inactive' and not active) or
      ($3='needs_implementation' and not standard_input_compatible))`;
  const total=await sql.query("select count(*)::integer as total from public.litix_boostero_inventory "+where,[platform,q,status]);
  const rows=await sql.query(
   "select supplier_service_id,service_name,supplier_category,platform,service_kind,order_type,wholesale_per_1000,minimum_quantity,maximum_quantity,refill_eligible,cancel_eligible,dripfeed_eligible,refill_days,standard_input_compatible,active,last_seen_at from public.litix_boostero_inventory "+where+
   " order by case when platform='Instagram' then 0 when platform='TikTok' then 1 else 2 end,platform,service_kind,wholesale_per_1000,supplier_service_id limit 50 offset $4",
   [platform,q,status,(page-1)*50]
  );
  return reply({supplier:"boostero",ownerOnly:true,activeCatalogSource:"api_v2",
   latestSync:sync[0]||null,platforms:groups,total:total[0]?.total||0,page,perPage:50,
   items:rows,publicPurchasingControlledBy:"litix_boostero_services"});
 }catch{return reply({error:"inventory_unavailable"},503)}
}
