// One-shot private Preview build audit. No API route, no orders, no public output.
// The only API actions possible in the client are balance and services.
// Logs intentionally contain only sanitized counts/wholesale metadata, never keys or raw response bodies.
import {boosteroReadOnly,boosteroFollowers} from "../lib/boosteroReadOnly.mjs";
const log=x=>console.log("LITIX_BOOSTERO_READONLY_AUDIT "+JSON.stringify(x));
if(process.env.VERCEL_ENV!=="preview"){
 log({stage:"gate",status:"not_preview",skipped:true});
 process.exit(0);
}
const errors=[];
let balanceOk=false,serviceOk=false;
try{
 const b=await boosteroReadOnly("balance");
 const value=String(b.balance??"");
 const number=Number(value);
 const currency=String(b.currency||"").replace(/[^A-Za-z]/g,"").slice(0,8);
 balanceOk=Number.isFinite(number)&&number>=0;
 log({stage:"balance",authenticated:balanceOk,balance:balanceOk?number:null,currency:currency||null});
}catch(e){errors.push("balance:"+String(e.message||"unknown").slice(0,80));log({stage:"balance",authenticated:false,error:errors.at(-1)});}
try{
 const all=await boosteroReadOnly("services");
 const followers=boosteroFollowers(all);
 serviceOk=true;
 const byPlatform=["Instagram","TikTok"].map(platform=>{
  const rows=followers.filter(x=>x.platform===platform);
  const withRefills=rows.filter(x=>x.refill30Plus);
  return {platform,services:rows.length,refill30Plus:withRefills.length};
 });
 log({stage:"services",authenticated:true,allServices:all.length,followers:followers.length,byPlatform});
 // Log only safe, normalized whitelisted data and never the supplier raw JSON.
 for(const platform of ["Instagram","TikTok"]){
  const candidates=followers.filter(x=>x.platform===platform&&x.refill30Plus)
   .sort((a,b)=>a.wholesalePer1000USD-b.wholesalePer1000USD).slice(0,20);
  for(const x of candidates)log({stage:"30plus",platform,...x});
  const alternatives=followers.filter(x=>x.platform===platform)
   .sort((a,b)=>a.wholesalePer1000USD-b.wholesalePer1000USD).slice(0,8);
  for(const x of alternatives)log({stage:"lowest_cost",platform,...x});
 }
}catch(e){errors.push("services:"+String(e.message||"unknown").slice(0,80));log({stage:"services",authenticated:false,error:errors.at(-1)});}
log({stage:"end",connectionStatus:balanceOk&&serviceOk?"authenticated":balanceOk||serviceOk?"partial":"failed",actions:["balance","services"],ordersPlaced:0,supplierChanged:false,pricingChanged:false,errors});
