import {GET as getCatalog} from "../../catalog/v1/route.js";
import {isInstagramLikes} from "../../../../lib/choosePosts.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req){
 try{
  const items=[];
  let status="unavailable";
  for(let page=1;page<=5;page++){
   const url=new URL(req.url);url.pathname="/api/catalog/v1";url.search="";
   url.searchParams.set("platform","Instagram");url.searchParams.set("kind","likes");url.searchParams.set("page",String(page));
   let response=await getCatalog(new Request(url));
   if(!response.ok&&process.env.VERCEL_ENV==="preview"){
    response=await fetch("https://www.litix.net/api/catalog/v1?platform=Instagram&kind=likes&page="+page,{cache:"no-store",signal:AbortSignal.timeout(12000)});
   }
   if(!response.ok)break;
   const body=await response.json();
   status=body.catalogStatus||"unknown";
   items.push(...(body.items||[]).filter(x=>x.purchasable===true&&isInstagramLikes(x)).map(x=>({
    id:String(x.id),name:String(x.name).slice(0,170),per1000:Number(x.per1000),min:Number(x.supplierMin),recommendedMin:Number(x.min),
    max:Number(x.max),unitStep:Number(x.unitStep||1),refill:!!x.refill
   })));
   if(page*24>=Number(body.total||0))break;
  }
  return Response.json({services:items,status},{headers:{"cache-control":"no-store"}});
 }catch{return Response.json({services:[],status:"unavailable"},{status:503,headers:{"cache-control":"no-store"}});}
}
