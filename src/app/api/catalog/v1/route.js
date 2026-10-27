import { GET as catalog } from "../../[action]/route.js";
import {enabledBoosteroCards,filterBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request) {
 const url=new URL(request.url);
 url.pathname="/api/smmservices";
 const original=await catalog(new Request(url,request));
 // With Boostero off the SMMGLOB response is byte-for-byte unchanged.
 // If SMMGLOB is down, allow ONLY separately approved Boostero products;
 // never reroute legacy numeric service IDs or imply the original catalog is live.
 if(process.env.LITIX_BOOSTERO_ENABLED!=="true"||process.env.VERCEL_ENV!=="production")return original;
 let all;
 try{all=await enabledBoosteroCards()}catch{return original}
 if(!all.length)return original;
 const params=new URL(request.url).searchParams;
 const filtered=filterBoosteroCards(all,params);
 const fourCategory=/^(Instagram|TikTok)$/.test(params.get("platform")||"")&&/^(followers|likes)$/.test(params.get("kind")||"");
 if(!filtered.length){
  if(fourCategory&&!original.ok)return Response.json({items:[],recommendations:[],categories:[],total:0,allCount:0,
    catalogStatus:"unavailable",message:"Temporarily unavailable",page:1,supplierOutage:true},
    {headers:{"cache-control":"no-store"}});
  return original;
 }
 try{
  const page=Math.max(1,Number(new URL(request.url).searchParams.get("page")||1));
  // SMMGLOB is currently susceptible to 525s/timeouts. Fail over the
  // *catalog display* only, never an already-paid SMMGLOB order.
  const source=original.ok?await original.json():{items:[],recommendations:[],categories:[],total:0,allCount:0,page,
   catalogStatus:"smmglob_unavailable",supplierOutage:true};
  const originalItems=Array.isArray(source.items)?source.items:[];
  const payload={...source,
   items:page===1?[...originalItems,...filtered]:originalItems,
   total:Number(source.total||0)+filtered.length,
   allCount:Number(source.allCount||0)+all.length,
   categories:[...new Set([...(source.categories||[]),...all.map(s=>s.category)])].sort(),
   recommendations:(source.recommendations||[]).concat(
    page===1&&["7","30","90"].includes(params.get("horizon"))?
     filtered.filter(x=>params.get("goal")==="Grow audience"?x.kind==="followers":
      params.get("goal")==="Increase engagement"?x.kind==="likes":false).slice(0,3):[]),
   boosteroCatalogStatus:"live_allowlisted"};
  return Response.json(payload,{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch{return original}
}
