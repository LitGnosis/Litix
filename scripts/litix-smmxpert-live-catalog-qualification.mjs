// One-time supplier qualification, running ONLY during explicitly staged
// production builds with Vercel's encrypted environment variables.
// Read-only actions: services, balance. Never submit / refill / cancel orders.
import {supplierTrialReadOnly,summarizeSupplierTrialServices}
 from "../src/lib/supplierTrialReadOnly.mjs";
import {litixPlatform,litixKind} from "../src/lib/litixServiceClassify.mjs";
const key=process.env.LITIX_SMMXPERT_API_KEY;
if(!key){console.log("SMMXPERT_CATALOG_QUALIFY",JSON.stringify({authenticated:false,reason:"key_missing"}));process.exitCode=1}
else{
 try{
  const start=Date.now();
  const data=await supplierTrialReadOnly({provider:"smmxpert",action:"services",key});
  const wallet=await supplierTrialReadOnly({provider:"smmxpert",action:"balance",key});
  const valid=data.services;
  const normalized=valid.filter(s=>{
   const platform=litixPlatform(s.name,s.category),kind=litixKind(s.name,s.category);
   return ["Instagram","TikTok"].includes(platform)&&["followers","likes","views"].includes(kind)&&
    s.serviceType.toLowerCase()==="default"&&s.retailIndependentRate>0;
  }).map(s=>({
   id:s.id,platform:litixPlatform(s.name,s.category),kind:litixKind(s.name,s.category),
   geo:/\b(usa|us-only|american|united states)\b/i.test(s.name+" "+s.category)?"USA":"regular_or_other",
   rate:s.retailIndependentRate,min:s.min,max:s.max,
   refill:s.refill,cancel:s.cancel,name:s.name.slice(0,65)
  }));
  const counts={};for(const x of normalized){
   const label=x.platform+" "+x.kind;counts[label]=(counts[label]||0)+1;
  }
  const sample=normalized.slice().sort((a,b)=>
   Number(a.geo!=="USA")-Number(b.geo!=="USA")||a.rate-b.rate
  ).slice(0,14);
  console.log("SMMXPERT_CATALOG_QUALIFY",JSON.stringify({
   authenticated:true,accountCurrency:wallet.currency,
   walletFunded:Number(wallet.balance)>0,
   rateCurrency:"UNVERIFIED_MUST_CONFIRM_WITH_VENDOR",
   candidateCount:normalized.length,candidateCounts:counts,
   publicExampleRates:sample,
   serviceCount:valid.length,elapsedMs:Date.now()-start,
   noPurchases:true
  }));
  if(!normalized.length)process.exitCode=1;
 }catch(e){
  console.log("SMMXPERT_CATALOG_QUALIFY",JSON.stringify({
   authenticated:false,reason:String(e?.message??"error").slice(0,80),
   noPurchases:true
  }));
  process.exitCode=1;
 }
}
