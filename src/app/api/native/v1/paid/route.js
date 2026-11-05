// Independent first-party paid checkout. Disabled until pricing, migration,
// secure signing secret, NMI reconciliation and no-charge QA are approved.
import {neon} from "@neondatabase/serverless";
import {checkoutNativePaid,quoteNativeOffer} from "../../../../../lib/litixNativePaidEngine.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=40;
const headers={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const send=(body,status=200)=>Response.json(body,{status,headers});
export async function GET(){
 // No prices are publicly available unless an explicit controlled rollout.
 return send({supplier:"Litix Native",available:process.env.LITIX_NATIVE_PAID_ENABLED==="true"&&process.env.LITIX_NATIVE_RELEASE_APPROVAL==="approved-native-pro30-v1",
  settlementRequired:true,noThirdPartySupplier:true,artificialEngagementAvailable:false,
  checkoutEnabled:process.env.LITIX_NATIVE_PAID_ENABLED==="true"&&process.env.LITIX_NATIVE_RELEASE_APPROVAL==="approved-native-pro30-v1"&&
   process.env.VERCEL_ENV==="production"&&!!process.env.LITIX_NATIVE_ORDER_SECRET&&
   !!process.env.LITIX_NATIVE_PRICES_JSON});
}
export async function POST(request){
 if(process.env.LITIX_NATIVE_PAID_ENABLED!=="true"||
    process.env.LITIX_NATIVE_RELEASE_APPROVAL!=="approved-native-pro30-v1"||
    process.env.VERCEL_ENV!=="production")
  return send({error:"NATIVE_PAID_CHECKOUT_DISABLED",charged:false},503);
 const origin=request.headers.get("origin");
 if(!origin||origin!==new URL(request.url).origin)
  return send({error:"SAME_ORIGIN_REQUIRED",charged:false},403);
 if(!String(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
  return send({error:"JSON_REQUIRED",charged:false},415);
 if(Number(request.headers.get("content-length")||0)>9000)
  return send({error:"PAYLOAD_TOO_LARGE",charged:false},413);
 let data;
 try{const raw=await request.text();if(raw.length>9000)return send({error:"PAYLOAD_TOO_LARGE",charged:false},413);data=JSON.parse(raw);}
 catch{return send({error:"BAD_JSON",charged:false},400);}
 if(data?.action==="quote"){
  const q=quoteNativeOffer({serviceId:data.serviceId,brief:data.brief,env:process.env});
  return send(q.body,q.http);
 }
 const conn=process.env.LITIX_NATIVE_DATABASE_URL;
 if(!conn)return send({error:"NATIVE_DATABASE_NOT_CONFIGURED",charged:false},503);
 let sql;
 try{sql=neon(conn);}catch{return send({error:"NATIVE_DATABASE_NOT_CONFIGURED",charged:false},503);}
 const result=await checkoutNativePaid({data,env:process.env,sql});
 return send(result.body,result.http);
}
