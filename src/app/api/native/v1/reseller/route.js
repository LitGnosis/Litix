// B2B supplier interface. No client payments or third-party engagement fulfillment.
// POST requires a verified partner key and an explicit server-side enable flag.
import {neon} from "@neondatabase/serverless";
import {nativePartnerPublicCatalog,executeNativePartnerAction} from "../../../../../lib/litixNativePartnerApi.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const response=(body,status=200)=>Response.json(body,{status,headers});
export async function GET(){return response(nativePartnerPublicCatalog());}
export async function POST(request){
 if(process.env.LITIX_NATIVE_PARTNER_ORDERS_ENABLED!=="true")
  return response({error:"PARTNER_ORDERS_DISABLED",charged:false},503);
 const origin=request.headers.get("origin");
 if(origin){
  try{if(new URL(request.url).origin!==origin)return response({error:"SERVER_TO_SERVER_ONLY"},403);}
  catch{return response({error:"SERVER_TO_SERVER_ONLY"},403);}
 }
 if(!String(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
  return response({error:"JSON_REQUIRED"},415);
 if(Number(request.headers.get("content-length")||0)>9000)return response({error:"REQUEST_TOO_LARGE"},413);
 let payload;
 try{
  const body=await request.text();
  if(body.length>9000)return response({error:"REQUEST_TOO_LARGE"},413);
  payload=JSON.parse(body);
 }catch{return response({error:"INVALID_JSON"},400);}
 const dbUrl=process.env.LITIX_NATIVE_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL;
 if(!dbUrl)return response({error:"PARTNER_DATABASE_UNAVAILABLE"},503);
 const auth=String(request.headers.get("authorization")||"");
 const key=auth.match(/^Bearer ([A-Za-z0-9_-]{40,256})$/)?.[1]||"";
 let sql;
 try{sql=neon(dbUrl);}catch{return response({error:"PARTNER_DATABASE_UNAVAILABLE"},503);}
 const result=await executeNativePartnerAction({payload,key,env:process.env,sql});
 return response(result.body,result.status);
}
