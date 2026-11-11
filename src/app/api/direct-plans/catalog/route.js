import {NextResponse} from "next/server";
export const runtime="nodejs";export const dynamic="force-dynamic";
const staticPrices={PANEL_149_WK:14900,AGENCY_500_WK:50000,ENTERPRISE_1500_WK:150000};
export async function GET(){
  const api=process.env.LITIX_DIRECT_API_URL||"";
  const token=process.env.LITIX_INTERNAL_SERVICE_TOKEN||"";
  let canCheckout=false;
  if(/^https:\/\//.test(api)&&token.length>=32){
    try{
      const r=await fetch(new URL("/v1/plans",api),{
        headers:{"authorization":`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(8000)
      });
      if(r.ok)canCheckout=(await r.json()).checkout_enabled===true;
    }catch{}
  }
  return NextResponse.json({providedBy:"Litix",currency:"USD",billingPeriod:"week",
    pricesCents:staticPrices,handles:{AGENCY_500_WK:25,ENTERPRISE_1500_WK:100},
    checkoutEnabled:canCheckout&&process.env.LITIX_DIRECT_RECURRING_CHECKOUT_ENABLED==="true",
    mediaEngine:"Litix Content Studio",supplierResellerApisUsed:0,
    falseEngagementGuarantees:0},{headers:{"cache-control":"no-store"}});
}
