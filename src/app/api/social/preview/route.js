import {createHash} from "node:crypto";
import {normalizeProfile,normalizePosts} from "../../../../lib/postPicker.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const actors={instagram:"coregent~instagram-posts-scraper",tiktok:"transparent_meteorite~tiktok-public-profile-scraper"};
const reply=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
function redisConfig(){
 const raw=process.env.UPSTASH_REDIS_REST_URL||process.env.REDIS_REST_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.REDIS_REST_TOKEN;
 if(!raw||!token)return null;
 const u=new URL(raw);
 if(u.protocol!=="https:"||u.username||u.password||u.port||!u.hostname.endsWith(".upstash.io"))
  throw Error("redis_rest_endpoint_invalid");
 return {url:u.origin,token};
}
async function redis(command,config){
 const r=await fetch(config.url,{method:"POST",cache:"no-store",
  headers:{"authorization":"Bearer "+config.token,"content-type":"application/json"},
  body:JSON.stringify(command),signal:AbortSignal.timeout(3000)});
 if(!r.ok)throw Error("redis_http_"+r.status);
 const result=await r.json();
 if(result.error)throw Error("redis_operation_failed");
 return result.result;
}
async function actorRows(platform,handle){
 const actor=actors[platform];
 const input=platform==="instagram"
  ?{profiles:[handle],resultsLimit:12,includeOwnerDetails:true,includeMediaUrls:true}
  :{profiles:[handle],resultsType:"posts",resultsPerPage:12,includeVideoDetails:false,maxItems:12};
 const r=await fetch("https://api.apify.com/v2/acts/"+actor+"/run-sync-get-dataset-items?maxItems=12",{
  method:"POST",cache:"no-store",redirect:"error",
  headers:{"authorization":"Bearer "+process.env.APIFY_TOKEN,"content-type":"application/json"},
  body:JSON.stringify(input),signal:AbortSignal.timeout(40000)});
 if(!r.ok)throw Error("public_profile_lookup_failed");
 const rows=await r.json();
 if(!Array.isArray(rows))throw Error("public_profile_response_invalid");
 return rows;
}
function verifiedHttpsImage(value){
 try{const u=new URL(String(value||""));return u.protocol==="https:"&&!u.username&&!u.password&&u.port===""?u.href:null}catch{return null}
}
function profileInfo(rows){
 const first=rows[0]||{};
 const actor=first.authorMeta||first.owner||first.user||first.author||{};
 const privateAccount=[first.isPrivate,first.private,actor.isPrivate,actor.private].includes(true);
 const avatar=verifiedHttpsImage(first.ownerProfilePicUrl||first.profilePicUrl||
  first.authorAvatar||actor.avatar||actor.profilePicture||actor.avatarUrl||actor.profilePicUrl);
 const count=[first.ownerFollowersCount,first.followersCount,actor.followersCount,
  actor.fans,actor.followerCount].find(v=>v!==null&&v!==undefined&&Number.isSafeInteger(Number(v))&&Number(v)>=0);
 return {privateAccount,avatar,followerCount:count===undefined?null:Number(count)};
}
export async function GET(request){
 if(process.env.LITIX_POST_PICKER_ENABLED!=="true"||!process.env.APIFY_TOKEN)
  return reply({error:"Public profile preview is not enabled"},503);
 const params=new URL(request.url).searchParams;
 const platform=String(params.get("platform")||"").toLowerCase();
 const handle=normalizeProfile(platform,params.get("username"));
 if(!handle)return reply({error:"Enter a valid Instagram or TikTok public profile"},422);
 let config;
 try{config=redisConfig()}catch{return reply({error:"Profile preview cache configuration invalid"},503)}
 if(!config)return reply({error:"Profile preview cache not configured"},503);
 const ip=String(request.headers.get("x-vercel-forwarded-for")||request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").slice(0,100);
 const ipHash=createHash("sha256").update(ip).digest("hex");
 const key="litix:public-preview:v1:"+platform+":"+handle.toLowerCase();
 try{
  const throttle="litix:preview-rate:"+ipHash+":"+Math.floor(Date.now()/600000);
  const hits=Number(await redis(["INCR",throttle],config));
  if(hits===1)await redis(["EXPIRE",throttle,600],config);
  if(hits>15)return reply({error:"Too many profile lookups. Try again soon."},429);
  const cached=await redis(["GET",key],config);
  if(cached){
   const value=JSON.parse(cached);
   if(value?.platform===platform&&value?.username===handle)return reply(value);
  }
  const rows=await actorRows(platform,handle);
  const info=profileInfo(rows);
  if(info.privateAccount)return reply({error:"This profile is private. Only public profiles can be previewed."},403);
  const posts=normalizePosts(platform,handle,rows).slice(0,12);
  if(!posts.length)return reply({error:"No verified public posts returned. Enter individual public post links instead."},404);
  const value={platform,username:handle,avatar:info.avatar,followerCount:info.followerCount,
   posts,publicProfileVerified:true,asOf:new Date().toISOString()};
  await redis(["SET",key,JSON.stringify(value),"EX",600],config);
  return reply(value);
 }catch(error){
  console.error("litix_social_preview_failed",{code:String(error?.message||"lookup").slice(0,48)});
  return reply({error:"Public profile preview is temporarily unavailable; manual post links remain supported."},503);
 }
}
