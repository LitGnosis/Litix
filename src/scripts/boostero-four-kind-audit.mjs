// PREVIEW READ-ONLY audit; no secret or supplier purchase is printed or made.
import {boosteroReadOnly} from "../lib/boosteroReadOnly.mjs";
if(process.env.VERCEL_ENV!=="preview"){console.log("BOOSTERO_CATALOG_AUDIT skipped_not_preview");process.exit(0)}
try{
 const services=await boosteroReadOnly("services");
 const out={};
 for(const p of ["Instagram","TikTok"])for(const kind of ["Followers","Likes"]){
  const rows=services.filter(x=>{
    const label=[x?.name,x?.category].join(" ");
    const platform=p==="Instagram"?/instagram|\bIG\b/i:/tiktok|tik[ -]?tok/i;
    const activity=kind==="Followers"?/\bfollowers?\b/i:/\blikes?\b/i;
    return platform.test(label)&&activity.test(label)&&!(kind==="Likes"&&/followers?/i.test(label));
  }).map(x=>({id:String(x.service??x.id),name:String(x.name||"").slice(0,175),
   category:String(x.category||"").slice(0,110),type:String(x.type||"Default"),
   rate:Number(x.rate),min:Number(x.min),max:Number(x.max),
   refill:x.refill===true||String(x.refill)==="1",fields:Object.keys(x).filter(k=>!/key|token|secret/i.test(k)).slice(0,23)}))
   .filter(x=>/^\d{1,12}$/.test(x.id)&&Number.isFinite(x.rate)&&x.rate>0&&x.min>=1&&x.max>=x.min)
   .sort((a,b)=>a.rate-b.rate);
  out[p+" "+kind]={count:rows.length,candidates:rows.slice(0,11)};
 }
 console.log("BOOSTERO_CATALOG_AUDIT "+JSON.stringify(out));
}catch(e){console.log("BOOSTERO_CATALOG_AUDIT_FAILED "+String(e.message).slice(0,100));process.exitCode=1}
