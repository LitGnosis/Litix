import {boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {quoteCuratedCart,publicCartQuote} from "../../../../lib/litixCartQuote.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;
const noStore={"cache-control":"no-store","x-content-type-options":"nosniff"};
export async function POST(request){
 if(!boosteroProductionReady())
  return Response.json({ready:false,error:"Checkout is temporarily unavailable"},{status:503,headers:noStore});
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return Response.json({ready:false,error:"same_origin_required"},{status:403,headers:noStore});
 try{
  const raw=await request.text();
  if(raw.length>3600)return Response.json({ready:false,error:"Invalid request"},{status:413,headers:noStore});
  const body=JSON.parse(raw);
  const cart=await quoteCuratedCart({
   serviceId:body.serviceId,quantity:body.quantity,
   includeBump:body.includeBump===true,
   mainTarget:body.link||"",bumpTarget:body.bumpLink||""
  });
  return Response.json(publicCartQuote(cart),{headers:noStore});
 }catch(e){
  const code=String(e?.message||"quote_unavailable");
  const status=/invalid_|not_supported|disabled|unavailable/.test(code)?409:503;
  return Response.json({ready:false,error:"The selected offer is unavailable. Review your link or choose another package.",
   code:code.slice(0,64),chargeAttempted:false},{status,headers:noStore});
 }
}
