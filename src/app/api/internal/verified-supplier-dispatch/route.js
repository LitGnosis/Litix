import {timingSafeEqual} from "node:crypto";
import {dispatchVerifiedSupplierOrder} from "../../../../lib/litixVerifiedSupplierRouter.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const out=(data,status=200)=>Response.json(data,{
 status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
});
export async function POST(request){
 if(process.env.VERCEL_ENV!=="production"||
    process.env.LITIX_VERIFIED_SUPPLIER_FAILOVER_ENABLED!=="true")
  return out({error:"supplier_routing_not_released",chargeAttempted:false},503);
 const expected=process.env.LITIX_INTERNAL_SERVICE_TOKEN||"";
 const got=request.headers.get("authorization")||"";
 const wanted="Bearer "+expected;
 if(expected.length<32||got.length!==wanted.length||
    !timingSafeEqual(Buffer.from(got),Buffer.from(wanted)))
  return out({error:"internal_auth_required"},401);
 let body;
 try{body=await request.json()}catch{return out({error:"invalid_json"},400)}
 if(!body||Object.keys(body).length!==1||
   !/^ltx2_[a-f0-9-]{36}$/.test(String(body.orderId||"")))
  return out({error:"invalid_order_id"},422);
 const state=await dispatchVerifiedSupplierOrder(body.orderId);
 return out(state,["SUBMITTED"].includes(state.state)?200:202);
}
