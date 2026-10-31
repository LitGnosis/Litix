import {backupSignal} from "./guardian-external-backup-signal.mjs";
// Runs on GitHub Actions, outside Vercel. Uses ONLY unauthenticated read-only
// Litix checks and GitHub issue API; optional independent Resend API key.
const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY;
if(!token||!repo||!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error("GitHub Actions repository token required");
const api="https://api.github.com/repos/"+repo;
const title="[Litix Guardian] External uptime incident";
const now=()=>new Date().toISOString();
const gh=async(path,options={})=>{
 const res=await fetch(api+path,{...options,headers:{
  "authorization":"Bearer "+token,"accept":"application/vnd.github+json",
  "x-github-api-version":"2022-11-28","content-type":"application/json",...(options.headers||{})
 },signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error("GitHub issue API failed HTTP "+res.status);
 if(res.status===204)return {};
 return res.json();
};
async function probe(){
 const base="https://www.litix.net";
 const checks=[
  ["functional",base+"/api/guardian/probe",o=>o.functional===true&&o.service==="litix-guardian"],
  ["catalog",base+"/api/catalog/v1?platform=TikTok",o=>o.catalogStatus==="live"&&o.total>0&&o.allCount>0&&o.items?.length>0]
 ];
 const results=await Promise.all(checks.map(async([name,url,validate])=>{
  try{
   const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(30000)});
   if(!r.ok)return {name,ok:false,code:"HTTP_"+r.status};
   const data=await r.json();
   return {name,ok:!!validate(data),code:validate(data)?"FUNCTIONAL_OK":"INVALID_HEALTH_RESPONSE"};
  }catch{return {name,ok:false,code:"NO_RESPONSE"}}
 }));
 return {ok:results.every(x=>x.ok),results};
}
const first=await probe();
let last=first;
if(!first.ok){
 await new Promise(resolve=>setTimeout(resolve,12000));
 last=await probe(); // fail twice before notifying (read-only, safe)
}
const verifiedDown=!first.ok&&!last.ok;
const issues=await gh("/issues?state=open&per_page=100");
const open=issues.find(x=>!x.pull_request&&x.title===title);
async function sendEmail(kind,issueNumber,details,scope="website"){
 if(!process.env.LITIX_GUARDIAN_EXTERNAL_RESEND_KEY)return {sent:false,reason:"external_email_secret_not_configured"};
 const key=process.env.LITIX_GUARDIAN_EXTERNAL_RESEND_KEY;
 const idempotency="guardian-external-"+issueNumber+"-"+kind;
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json","idempotency-key":idempotency},
  body:JSON.stringify({from:"Litix Guardian <orders@litix.net>",to:["Litixsocial@gmail.com"],
   subject:"LITIX Guardian EXTERNAL "+kind.toUpperCase()+" — "+scope,
   text:"Time UTC: "+now()+"\nEvent: "+kind+"\nAffected: "+scope+".\nDiagnostics: "+JSON.stringify(details)+
    "\nProbable cause: Website/Vercel or catalog functionality is inaccessible.\nRepair: Review Vercel deployments and runtime errors; check catalog health. No orders or payments were attempted."}),
  signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("External Resend alert HTTP "+response.status);
 return {sent:true};
}
if(verifiedDown&&!open){
 const details=last.results.map(x=>x.name+"="+x.code).join(", ");
 const created=await gh("/issues",{method:"POST",body:JSON.stringify({title,body:"Guardian external outage detected at "+now()+" UTC.\n\nTwo independent read-only attempts failed.\n\nComponents: "+details+"\n\nInspect Vercel production logs, the Guardian private dashboard, and current Litix catalog response. **No payment or supplier orders were attempted.**"})});
 try{await sendEmail("outage",created.number,details)}catch(e){console.error("Independent email unavailable",String(e?.message||"").slice(0,60))}
 console.log("Created independent outage incident",created.number);
}else if(first.ok&&open){
 // Do not close on one transient success; verify a second read-only success.
 await new Promise(resolve=>setTimeout(resolve,12000));
 const recovered=await probe();
 if(recovered.ok){
  await gh("/issues/"+open.number+"/comments",{method:"POST",body:JSON.stringify({body:"Confirmed recovery at "+now()+" UTC — independent website and TikTok catalog probes returned usable results twice."})});
  await gh("/issues/"+open.number,{method:"PATCH",body:JSON.stringify({state:"closed"})});
  try{await sendEmail("recovery",open.number,recovered.results)}catch(e){console.error("Independent recovery email unavailable",String(e?.message||"").slice(0,60))}
  console.log("Closed independent outage",open.number);
 }
}else console.log("Guardian external state unchanged",{ok:first.ok,openIncident:!!open});

// Independently audit last scheduled encrypted R2 dual-database backup. A live
// storefront cannot validate backups, and probe-only success is not a restore.
const backupTitle="[Litix Guardian] Encrypted backup incident";
let backup;
try{
 const runs=await gh("/actions/workflows/litix-r2-manual-production-verify.yml/runs?branch=main&event=schedule&per_page=8");
 backup=backupSignal(runs,new Date());
}catch{backup={ok:false,code:"R2_WORKFLOW_HISTORY_UNAVAILABLE"}}
const backupOpen=issues.find(x=>!x.pull_request&&x.title===backupTitle);
if(!backup.ok&&!backupOpen){
 const body="Litix encrypted-backup watchdog detected "+backup.code+" at "+now()+
  " UTC.\n\nThe last scheduled Cloudflare R2 dual-Neon encrypted backup and isolated restore is unverified. "+
  "Investigate the GitHub Actions R2 workflow and storage configuration; never disable backup checks, delete recovery data or print secrets. "+
  "The watchdog did not touch customer databases, payments, or supplier orders.";
 const ticket=await gh("/issues",{method:"POST",body:JSON.stringify({title:backupTitle,body})});
 try{await sendEmail("outage",ticket.number,backup.code,"encrypted database backups")}
 catch{console.error("Backup email alert unavailable; incident recorded");}
 console.error("Encrypted R2 backup recovery requires attention",backup.code);
}else if(backup.ok&&backupOpen){
 await gh("/issues/"+backupOpen.number+"/comments",{method:"POST",body:JSON.stringify({body:"Confirmed last scheduled encrypted dual-Neon backup and isolated restore successful at "+now()+" UTC. Closing incident."})});
 await gh("/issues/"+backupOpen.number,{method:"PATCH",body:JSON.stringify({state:"closed"})});
 try{await sendEmail("recovery",backupOpen.number,backup.code,"encrypted database backups")}
 catch{console.error("Backup recovery email unavailable; incident closed");}
}else console.log("R2 independent backup state",{ok:backup.ok,code:backup.code,openIncident:!!backupOpen});
// Github Actions independently records failure even if Resend/issue notifications
// are unavailable. A red watchdog run must not be interpreted as healthy.
if(verifiedDown||!backup.ok)process.exitCode=1;
