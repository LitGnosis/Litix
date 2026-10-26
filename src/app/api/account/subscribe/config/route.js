import { authenticatedCustomer, customerAuthConfigured } from "../../../../../lib/customerAuth.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 if(!customerAuthConfigured())return Response.json({enabled:false},{headers:{"cache-control":"private, no-store"}});
 const user=await authenticatedCustomer();
 if(!user)return Response.json({enabled:false},{status:401,headers:{"cache-control":"private, no-store"}});
 const publicKey=process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY;
 const enabled=process.env.VERCEL_ENV==="production" &&
  process.env.NMI_GATEWAY_MODE==="PRODUCTION" &&
  process.env.LITIX_NMI_RECURRING_MERCHANT_APPROVED==="true" &&
  process.env.LITIX_AUTOLIKES_LIVE_ENROLL_ENABLED==="true" &&
  process.env.LITIX_AUTOLIKES_DISPATCH_ENABLED==="true" &&
  process.env.LITIX_AUTOLIKES_SOURCE_VERIFIED==="true" &&
  Boolean(process.env.SMMGLOB_API_KEY) &&
  Boolean(process.env.LITIX_NMI_WEBHOOK_SIGNING_KEY||process.env.NMI_WEBHOOK_SIGNING_KEY) &&
  Boolean(process.env.LITIX_AUTOLIKES_DATABASE_URL) &&
  Boolean(process.env.NMI_SECURITY_KEY&&publicKey);
 return Response.json({enabled,publicKey:enabled?publicKey:null,currency:"USD",recurring:"monthly"},{headers:{"cache-control":"private, no-store"}});
}
