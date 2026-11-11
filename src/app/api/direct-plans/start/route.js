import {NextResponse} from "next/server";
export const runtime="nodejs";export const dynamic="force-dynamic";
const PLANS=["PANEL_149_WK","AGENCY_500_WK","ENTERPRISE_1500_WK"];
export async function POST(request){
  const fail=(status,message)=>NextResponse.json({error:message},{status,headers:{"cache-control":"no-store"}});
  if(new URL(request.url).origin!==request.headers.get("origin"))return fail(403,"same_origin_required");
  let input;try{input=await request.json()}catch{return fail(400,"invalid_json")}
  if(!PLANS.includes(input?.tier))return fail(422,"invalid_tier");
  const api=process.env.LITIX_DIRECT_API_URL||"";
  const token=process.env.LITIX_INTERNAL_SERVICE_TOKEN||"";
  if(process.env.LITIX_DIRECT_RECURRING_CHECKOUT_ENABLED!=="true"||
     !/^https:\/\//.test(api)||token.length<32)return fail(503,"paykings_recurring_not_activated");
  try{
    const readiness=await fetch(new URL("/v1/checkout/readiness",api),{
      method:"POST",headers:{"authorization":`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(8000)
    });
    if(!readiness.ok)return fail(503,"merchant_or_fulfillment_gate_closed");
    const links={
      PANEL_149_WK:process.env.LITIX_NMI_HOSTED_PANEL_PLAN_URL,
      AGENCY_500_WK:process.env.LITIX_NMI_HOSTED_AGENCY_500_URL,
      ENTERPRISE_1500_WK:process.env.LITIX_NMI_HOSTED_AGENCY_1500_URL
    };
    const url=new URL(links[input.tier]||"");
    if(url.protocol!=="https:"||!["secure.nmi.com","secure.prep.nmi.com"].includes(url.hostname))
      return fail(503,"approved_gateway_checkout_link_missing");
    return NextResponse.json({url:url.toString(),provider:"PayKings/NMI",requiresVerifiedSettlement:true},
      {headers:{"cache-control":"no-store"}});
  }catch{return fail(503,"paykings_recurring_unavailable")}
}
