export const runtime="nodejs";
export const dynamic="force-dynamic";
// Owned digital-product discovery. No reseller catalog, API, credentials, or stock claims.
export async function GET(){
 return Response.json({
  brand:"Litix",source:"litix_first_party_only",catalogStatus:"owned_digital_only",
  items:[],recommendations:[],categories:[],platforms:[],total:0,allCount:0,
  checkoutEnabled:false, // Legacy social-service checkout remains closed.
  currency:"USD",firstPartyProducts:[
   {id:"litix_marketing_drafts",name:"12 Original Marketing Drafts",amountCents:100,currency:"USD",checkoutUrl:"/shop/marketing-drafts",kind:"original_digital_content"},
   {id:"litix_creative_kit",name:"Creative Kit",amountCents:0,currency:"USD",deliveryUrl:"/direct-services",kind:"original_digital_content"},
   {id:"litix_ai_content_studio",name:"AI Content Studio",amountCents:0,currency:"USD",deliveryUrl:"/ai-content-studio",kind:"creative_workspace"}
  ]
 },{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
