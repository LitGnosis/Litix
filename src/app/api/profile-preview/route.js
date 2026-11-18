import {GET as getPublicPosts} from "../post-picker/route.js";
import {normalizeProfile} from "../../../lib/postPicker.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Reuse the existing origin-restricted scraper configuration, timeout,
// ten-minute cache and rate limit; no new credentials or untrusted URL fetches.
export async function GET(request){
 const url=new URL(request.url);
 const platform=String(url.searchParams.get("platform")||"").toLowerCase();
 const handle=normalizeProfile(platform,url.searchParams.get("username"));
 if(!handle)return Response.json({error:"Enter a valid public Instagram or TikTok profile."},
  {status:422,headers:{"cache-control":"no-store"}});
 url.pathname="/api/post-picker";
 url.searchParams.set("platform",platform);
 url.searchParams.set("username",handle);
 return getPublicPosts(new Request(url,{method:"GET",headers:request.headers}));
}
