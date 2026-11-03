// Run locally after each vendor issues a reseller API key. Does not send
// add/refill/cancel/payment actions. Never print keys, balance or raw quotes.
import {TRIAL_PROVIDERS,supplierTrialReadOnly,summarizeSupplierTrialServices}
 from "../src/lib/supplierTrialReadOnly.mjs";

let success=0;
for(const [provider,info] of Object.entries(TRIAL_PROVIDERS)){
 const key=process.env[info.keyEnvironment];
 if(!key){
  console.log(JSON.stringify({provider,status:"awaiting_trial_credentials",
   next:"Register and obtain a trial API key from the vendor account"}));
  continue;
 }
 const started=Date.now();
 try{
  const data=await supplierTrialReadOnly({provider,action:"services",key});
  const elapsedMs=Date.now()-started;
  const summary=summarizeSupplierTrialServices(data);
  const wallet=await supplierTrialReadOnly({provider,action:"balance",key});
  console.log(JSON.stringify({provider,status:"read_only_pass",
   catalogResponseMs:elapsedMs,catalogCount:summary.count,
   invalidEntries:summary.invalidCount,platformCounts:summary.platformCounts,
   balanceCurrency:wallet.currency,
   note:"Wholesale costs, API keys and balance are intentionally omitted"}));
  success++;
 }catch(error){
  console.log(JSON.stringify({provider,status:"read_only_failed",
   code:String(error?.message||"supplier_trial_unavailable").slice(0,75)}));
  process.exitCode=1;
 }
}
if(success===0)console.log("No vendor credentials available. No orders, API requests or payments initiated.");
