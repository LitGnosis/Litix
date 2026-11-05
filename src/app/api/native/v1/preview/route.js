import {previewLitixNativeAsset} from "../../../../../lib/litixNativeSupplier.mjs";
const headers={"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
export const runtime="nodejs";
const error=(code,status=400)=>Response.json({error:code,charged:false,delivered:false},{status,headers});
export async function POST(request){
 const origin=request.headers.get("origin");
 if(origin){
  try{if(origin!==new URL(request.url).origin)return error("ORIGIN_NOT_ALLOWED",403);}
  catch{return error("ORIGIN_NOT_ALLOWED",403);}
 }
 const type=String(request.headers.get("content-type")||"").toLowerCase();
 if(!type.startsWith("application/json"))return error("JSON_REQUIRED",415);
 const declared=Number(request.headers.get("content-length")||0);
 if(declared>8000)return error("BRIEF_TOO_LARGE",413);
 let data;
 try{
  const raw=await request.text();
  if(raw.length>8000)return error("BRIEF_TOO_LARGE",413);
  data=JSON.parse(raw);
 }catch{return error("INVALID_JSON");}
 if(!data||typeof data!=="object"||Array.isArray(data))return error("INVALID_BRIEF");
 try{
  const asset=previewLitixNativeAsset(data);
  if(asset.content.length>25000)return error("GENERATED_ASSET_TOO_LARGE",422);
  return Response.json(asset,{status:200,headers});
 }catch(ex){
  const message=String(ex?.message||"INVALID_BRIEF");
  const code=/^NATIVE_[A-Z_]+$/.test(message)?message:"INVALID_OR_INCOMPLETE_BRIEF";
  return error(code,422);
 }
}
export async function GET(){return error("POST_REQUIRED",405);}
