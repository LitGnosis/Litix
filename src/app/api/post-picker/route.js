import {normalizeProfile,normalizePosts} from "../../../lib/postPicker.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const actors={instagram:"coregent~instagram-posts-scraper",tiktok:"vtrdev~tiktok-scraper"};
// Secondary public TikTok profile scraper has an independent public post source.
// Both are media-discovery tools only; neither processes checkout or fulfillment.
const tiktokFallbackActor="tokfluence~tiktok-profile-scraper";
async function actorRows(actor,input,timeoutMs){
  const response=await fetch("https://api.apify.com/v2/acts/"+actor+"/run-sync-get-dataset-items?maxItems=12",{
    method:"POST",
    headers:{"authorization":"Bearer "+process.env.APIFY_TOKEN,"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify(input),cache:"no-store",signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response.ok)throw new Error("actor_status_"+response.status);
  const rows=await response.json();
  return Array.isArray(rows)?rows:[];
}
const cached=new Map(),limits=new Map();
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});

function allowRequest(key){
  const now=Date.now(),previous=limits.get(key);
  const next=!previous||now-previous.start>600000?{start:now,count:1}:{start:previous.start,count:previous.count+1};
  limits.set(key,next);
  if(limits.size>600)limits.clear();
  return next.count<=8;
}

export async function GET(request){
  if(process.env.LITIX_POST_PICKER_ENABLED!=="true"||!process.env.APIFY_TOKEN){
    return json({error:"Visual post selection is not enabled yet. Regular checkout is unchanged."},503);
  }
  const params=new URL(request.url).searchParams;
  const platform=String(params.get("platform")||"").toLowerCase();
  const handle=normalizeProfile(platform,params.get("username"));
  if(!handle)return json({error:"Enter a valid public Instagram or TikTok username or profile link."},400);
  const id=request.headers.get("x-vercel-forwarded-for")||request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
  if(!allowRequest(String(id).slice(0,100)))return json({error:"Too many lookups. Try again shortly."},429);
  const cacheKey=platform+":"+handle,hit=cached.get(cacheKey);
  if(hit&&Date.now()-hit.time<600000)return json(hit.value);

  // Server-only validated inputs prevent cross-site requests and API-key leaks.
  const input=platform==="instagram"
    ?{profiles:[handle],resultsLimit:12,includeOwnerDetails:false,includeMediaUrls:true}
    :{startUrls:["https://www.tiktok.com/@"+handle],limit:12};
  let posts=[],primaryFailed=false,fallbackFailed=false;
  try{
    const primary=await actorRows(actors[platform],input,platform==="tiktok"?18000:44000);
    posts=normalizePosts(platform,handle,primary).slice(0,12);
  }catch(error){
    primaryFailed=true;
    console.warn("Litix post discovery primary unavailable",platform,String(error?.name||"provider_error").slice(0,32));
  }
  if(platform==="tiktok"&&!posts.length){
    try{
      const rows=await actorRows(tiktokFallbackActor,{
        profiles:[handle],resultsPerPage:12,maxResults:12,profileSorting:"latest",mode:"auto"
      },31500);
      posts=normalizePosts("tiktok",handle,rows).slice(0,12);
    }catch(error){
      fallbackFailed=true;
      console.warn("Litix TikTok secondary discovery unavailable",String(error?.name||"provider_error").slice(0,32));
    }
  }
  if(!posts.length&&(primaryFailed||fallbackFailed))
    return json({error:"TikTok or Instagram video lookup is busy. Your order has not been charged. Retry or use direct post links below."},503);
  const value={platform,username:handle,posts,
    message:posts.length?"Select one or more public posts.":
      "No publicly accessible posts were returned. Try again or enter direct post links below."};
  if(posts.length>0)cached.set(cacheKey,{time:Date.now(),value});
  if(cached.size>100)cached.delete(cached.keys().next().value);
  return json(value);
}
