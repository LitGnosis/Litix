import {SUPPLIER_REGISTRY,supplierEvaluation,currentSupplierForNewOrder} from "../../../../../lib/platinumSupplierQualification.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 if(process.env.VERCEL_ENV!=="preview")
  return Response.json({error:"not_found"},{status:404,headers:{"cache-control":"no-store"}});
 const items=SUPPLIER_REGISTRY.map(x=>{
  const report=supplierEvaluation(x.code);
  return {code:x.code,name:x.name,role:x.role,
   docs:x.documentation,statusMethod:x.statusMethod,documentedStatus:x.documentedStatus,
   integrationApproved:false,purchasableViaNewIntegration:false,
   needsEvidence:report.missing};
 });
 return Response.json({
  mode:"preview_only",currentLiveSupplier:currentSupplierForNewOrder(),
  newSupplierPurchasingDisabled:true,productionDeployment:"dpl_68nf7SLM7QBztTTPVzHrqrsV7qhY",
  metrics:"account-specific uptime, balance and pricing have NOT been measured for candidate suppliers",
  items
 },{headers:{"cache-control":"no-store","x-robots-tag":"noindex","x-content-type-options":"nosniff"}});
}
