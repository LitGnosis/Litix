import {normalizeProfile,normalizePosts} from "../../../lib/postPicker.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const actors={instagram:"coregent~instagram-posts-scraper",tiktok:"vtrdev~tiktok-scraper"};
const cached=new Map(),limits=new Map();
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});

function allowRequest(key){
  const now=Date.now(),previous=limits.get(key);
  const next=!previous||now-previous.start>600000?{start:now,count:1}:{start:previous.start,count:previous.count+1};
  limits.set(key,next);
  if(limits.size>600)limits.clear();
  return next.count<=10;
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

  // Only fixed, reviewed actors are contacted. User input NEVER chooses a remote URL.
  const input=platform==="instagram"
    ?{profiles:[handle],resultsLimit:24,includeOwnerDetails:false,includeMediaUrls:true}
    :{startUrls:["https://www.tiktok.com/@"+handle],limit:24};
  try{
    const response=await fetch("https://api.apify.com/v2/acts/"+actors[platform]+"/run-sync-get-dataset-items",{
      method:"POST",
      headers:{"authorization":"Bearer "+process.env.APIFY_TOKEN,"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify(input),cache:"no-store",signal:AbortSignal.timeout(45000)
    });
    if(!response.ok)throw new Error("provider status "+response.status);
    const rows=await response.json();
    const posts=normalizePosts(platform,handle,rows);
    const value={platform,username:handle,posts,message:posts.length?"Select one or more public posts.":"No public post thumbnails were returned for this account."};
    cached.set(cacheKey,{time:Date.now(),value});
    if(cached.size>100)cached.delete(cached.keys().next().value);
    return json(value);
  }catch(error){
    console.error("Litix post gallery request failed",String(error?.name||"provider_error").slice(0,80));
    return json({error:"The post gallery is temporarily unavailable. No payment or supplier request was made."},503);
  }
}
