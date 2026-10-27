import { GET as catalog } from "../../[action]/route.js";
import {enabledBoosteroCards,filterBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request) {
 const url=new URL(request.url);
 url.pathname="/api/smmservices";
 const original=await catalog(new Request(url,request));
 // If Boostero is disabled or misconfigured, return the original SMMGLOB response exactly.
 if(!original.ok||process.env.LITIX_BOOSTERO_ENABLED!=="true"||process.env.VERCEL_ENV!=="production")return original;
 let all;
 try{all=await enabledBoosteroCards()}catch{return original}
 if(!all.length)return original;
 const filtered=filterBoosteroCards(all,new URL(request.url).searchParams);
 if(!filtered.length)return original;
 try{
  const source=await original.json();
  const page=Math.max(1,Number(new URL(request.url).searchParams.get("page")||1));
  return Response.json({...source,
   items:page===1?[...(source.items||[]),...filtered]:(source.items||[]),
   total:Number(source.total||0)+filtered.length,
   allCount:Number(source.allCount||0)+all.length,
   categories:[...new Set([...(source.categories||[]),...all.map(s=>s.category)])].sort()},
   {headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch{return original}
}
