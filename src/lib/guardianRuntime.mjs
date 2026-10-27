import {neon} from "@neondatabase/serverless";
import {randomUUID,createHash,timingSafeEqual} from "node:crypto";
import {componentKeys,nextGuardianState,safeCode} from "./guardianCore.mjs";
export const guardianDb=()=>{
 const url=process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL;
 if(!url)throw Error("GUARDIAN_DATABASE_UNCONFIGURED");
 return neon(url);
};
const base="https://www.litix.net";
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const codeOf=e=>/timeout|AbortError|terminated/i.test(String(e?.name||"")+" "+String(e?.message||""))?"TIMEOUT_OR_TERMINATED":"NETWORK_OR_RESPONSE_ERROR";
const get=async(path,timeout=9500)=>{
 const r=await fetch(base+path,{cache:"no-store",signal:AbortSignal.timeout(timeout)});
 if(!r.ok)throw Error("HTTP_"+r.status);
 return r;
};
async function retryReadOnly(fn,max=2){
 let last;
 for(let i=0;i<max;i++){
  try{return await fn()}catch(e){last=e;if(i<max-1)await wait(200*(2**i));}
 }
 throw last;
}
const check=async(component,operation)=>{
 const start=Date.now();
 try{const o=await operation();return {component,ok:o.kind==="not_launched"?true:o.ok!==false,
  kind:o.kind==="not_launched"?"not_launched":"check",code:safeCode(o.code||"OK"),
  detail:String(o.detail||"").slice(0,140),latencyMs:Date.now()-start}}
 catch(e){return {component,ok:false,kind:"check",code:codeOf(e),detail:"Read-only check unavailable",latencyMs:Date.now()-start}}
};
const catalog=async(path)=>{
 const r=await retryReadOnly(()=>get("/api/catalog/v1?"+path,26000));
 const d=await r.json();
 if(!Array.isArray(d.items)||!Number.isSafeInteger(d.total)||!Number.isSafeInteger(d.allCount)||
  d.items.length===0||d.total<=0||d.allCount<d.total||d.catalogStatus!=="live")
  return {ok:false,code:d.catalogStatus==="cached"?"CATALOG_CACHED_NOT_LIVE":"CATALOG_EMPTY_OR_INVALID",detail:"Catalog response lacks verified live usable services"};
 if(d.items.some(x=>!x.id||!x.name||!Number.isFinite(Number(x.per1000))||Number(x.per1000)<=0))
  return {ok:false,code:"CATALOG_UNUSABLE_PRICES",detail:"Catalog contains invalid service descriptions or retail amounts"};
 return {ok:true,code:"LIVE_SERVICES",detail:"Usable services verified: "+d.total+" filtered; "+d.allCount+" eligible"};
};
export async function performGuardianChecks(sql,priorByComponent={},now=new Date()){
 const every=15*60*1000, recent=name=>{const p=priorByComponent[name];return p?.checked_at && now.getTime()-new Date(p.checked_at).getTime()<every};
 const probes={
  website:()=>retryReadOnly(async()=>{const r=await get("/",9000);const t=await r.text();return {ok:t.includes("LITIX")||t.includes("Litix"),code:"WEBSITE_HTML",detail:"Homepage delivered Litix branding"}}),
  smmglob:async()=>{
   const endpoint=new URL(process.env.SMMGLOB_API_URL||"https://smmglob.com/api/v2");
   if(!process.env.SMMGLOB_API_KEY||endpoint.protocol!=="https:"||!["smmglob.com","www.smmglob.com"].includes(endpoint.hostname))
    return {ok:false,code:"SUPPLIER_CONFIG",detail:"SMMGLOB service credential or endpoint missing"};
   const d=await retryReadOnly(async()=>{
    const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
     body:new URLSearchParams({key:process.env.SMMGLOB_API_KEY,action:"services"}),cache:"no-store",signal:AbortSignal.timeout(11000)});
    if(!r.ok)throw Error("HTTP_"+r.status);
    return r.json();
   });
   return {ok:Array.isArray(d)&&d.length>0,code:Array.isArray(d)&&d.length>0?"SUPPLIER_READ_ONLY_OK":"SUPPLIER_INVALID_RESPONSE",
    detail:Array.isArray(d)?"Supplier service records: "+d.length:"Supplier service list invalid"};
  },
  catalog:()=>catalog("page=1"),
  tiktok:()=>catalog("platform=TikTok&page=1"),
  instagram:()=>catalog("platform=Instagram&page=1"),
  paykings_readiness:async()=>{const r=await get("/api/config");const d=await r.json();return {ok:d.ready===true&&!!d.publicKey,code:d.ready&&d.publicKey?"PAYKINGS_CONFIG_READY":"PAYKINGS_CONFIG_UNAVAILABLE",detail:"Readiness config only; no charge or merchant authorization attempted"}},
  bluevine_readiness:async()=>{const r=await get("/api/bundles");const d=await r.json();return {ok:d.bluevineEnabled===true&&Array.isArray(d.packages)&&d.packages.length===8,code:d.bluevineEnabled?"BLUEVINE_CONFIG_READY":"BLUEVINE_CONFIG_UNAVAILABLE",detail:"Fixed-link configuration only; never interpreted as a payment"}},
  autolikes:async()=>{const r=await get("/autolikes");const t=await r.text();return t.includes("COMING SOON")?{kind:"not_launched",code:"AUTOLIKES_COMING_SOON",detail:"AutoLikes intentionally not launched"}:{ok:t.includes("AUTOLIKES")||t.includes("AutoLikes"),code:"AUTOLIKES_PAGE",detail:"AutoLikes page responsive"}},
  subscriptions:async()=>{
   const rows=await sql.query("select to_regclass('public.litix_recurring_subscriptions')::text as existing");
   if(!rows[0]?.existing)return {kind:"not_launched",code:"SUBSCRIPTIONS_NOT_PROVISIONED",detail:"Subscription database table is not provisioned"};
   const r=await sql.query("select count(*)::int as n from public.litix_recurring_subscriptions");
   return {ok:true,code:"SUBSCRIPTIONS_STORAGE",detail:"Subscription records query succeeded; count "+Number(r[0]?.n||0)};
  },
  orders:async()=>{
   const a=await sql.query("select count(*)::int as n from public.litix_v2_orders");
   const b=await sql.query("select count(*)::int as n from public.litix_growth_bundle_orders");
   return {ok:true,code:"ORDER_STORAGE",detail:"Read-only order tables responsive; regular "+Number(a[0]?.n||0)+", bundles "+Number(b[0]?.n||0)};
  },
  fulfillment:async()=>{
   const r=await sql.query("select count(*)::int as pending from public.litix_v2_orders where supplier_order_id is not null and fulfillment_state in ('dispatching','submitted','in_progress','processing','manual_review')");
   return {ok:true,code:"FULFILLMENT_LEDGER",detail:"Supplier order ledger readable; open records "+Number(r[0]?.pending||0)+" (delivery not inferred)"};
  },
  database:async()=>{const r=await sql.query("select 1::int as alive");return {ok:r[0]?.alive===1,code:"DATABASE_READ_ONLY",detail:"Database read-only query succeeded"}},
  resend:async()=>{
   const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
   if(!key)return {ok:false,code:"RESEND_CONFIG_MISSING",detail:"Transactional email API key is not configured"};
   const r=await fetch("https://api.resend.com/domains",{headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(8000),cache:"no-store"});
   if(r.status===401||r.status===403)return {ok:false,code:"RESEND_API_AUTH",detail:"Resend domain-list credential rejected or insufficient permission"};
   if(!r.ok)throw Error("HTTP_"+r.status);
   const data=await r.json();const verified=Array.isArray(data.data)&&data.data.some(x=>x.name==="litix.net"&&x.status==="verified");
   return {ok:verified,code:verified?"RESEND_DOMAIN_VERIFIED":"RESEND_DOMAIN_NOT_VERIFIED",detail:verified?"Resend litix.net verified; no message was sent":"Resend litix.net not confirmed as verified"};
  }
 };
 // Supplier calls are rate-limited to 15 minutes per persistent component row.
 const skipped=new Set(["smmglob","resend"].filter(recent));
 const result=await Promise.all(componentKeys.filter(x=>!skipped.has(x)).map(x=>check(x,probes[x])));
 return result;
}
const sanitize=x=>({component:x.component,ok:x.ok,code:x.code,detail:x.detail,latencyMs:x.latencyMs,kind:x.kind});
const repair={website:"Inspect Vercel routing, deployment and runtime logs",smmglob:"Verify SMMGLOB account/API and inspect read-only supplier status; retry later",catalog:"Inspect /api/catalog/v1 upstream timeout/cache and verify usable items",tiktok:"Check TikTok supplier categories and service filtering",instagram:"Check Instagram supplier categories and service filtering",paykings_readiness:"Verify gateway configuration in Vercel; do not change keys automatically",bluevine_readiness:"Verify fixed Bluevine links and bundle environment flags; do not charge",autolikes:"Confirm planned AutoLikes launch state and subscription configuration",subscriptions:"Review subscription schema/permissions without editing customer subscriptions",orders:"Inspect read-only database connectivity and order-table permissions",fulfillment:"Review supplier order statuses manually; never submit or retry orders automatically",database:"Inspect Neon branch and Vercel database connection, avoid destructive changes",resend:"Inspect Resend API permissions and verified sending domain"};
async function queueAlert(sql,component,event,incidentId,obs,at){
 const incident=await sql.query("select started_at from public.litix_guardian_incidents where id=$1",[incidentId]);
 const eventKey="guardian-"+incidentId+"-"+event.kind+(event.kind==="escalation"?"-"+Math.floor(at.getTime()/3600000):"");
 const payload={time:at.toISOString(),component,event:event.kind,code:obs.code,detail:obs.detail||"Health check state changed",
  probableCause:obs.code,repair:repair[component]||"Inspect server diagnostics",
  startedAt:incident[0]?.started_at||at.toISOString()};
 await sql.query("insert into public.litix_guardian_alert_outbox(event_key,incident_id,component,kind,payload) values($1,$2,$3,$4,$5::jsonb) on conflict(event_key) do nothing",[eventKey,incidentId,component,event.kind,JSON.stringify(payload)]);
}
async function persistObservation(sql,o,at){
 await sql.query("insert into public.litix_guardian_components(component) values($1) on conflict(component) do nothing",[o.component]);
 const rows=await sql.query("select * from public.litix_guardian_components where component=$1",[o.component]);
 const prev=rows[0],{next,events}=nextGuardianState(prev,o,at);
 const incidentId=events.some(e=>e.kind==="outage")?"gi_"+randomUUID():next.active_incident_id;
 if(events.some(e=>e.kind==="outage"))next.active_incident_id=incidentId;
 const event=events[0];
 if(event?.kind==="outage")next.alert_at=at.toISOString();
 if(event?.kind==="escalation")next.escalation_at=at.toISOString();
 const update=await sql.query(
  "update public.litix_guardian_components set status=$2,consecutive_failures=$3,consecutive_successes=$4,checked_at=$5,last_healthy_at=case when $2='healthy' then $5 else last_healthy_at end,last_result=$6::jsonb,active_incident_id=$7,alert_at=$8,escalation_at=$9,updated_at=$5 where component=$1 and status=$10 and consecutive_failures=$11 and consecutive_successes=$12 and checked_at is not distinct from $13 returning component",
  [o.component,next.status,next.consecutive_failures,next.consecutive_successes,at.toISOString(),JSON.stringify(sanitize(o)),next.active_incident_id,next.alert_at,next.escalation_at,prev.status,prev.consecutive_failures,prev.consecutive_successes,prev.checked_at]);
 if(!update.length)return;
 if(event?.kind==="outage")await sql.query(
  "insert into public.litix_guardian_incidents(id,component,started_at,confirmed_at,severity,cause_code,summary) values($1,$2,$3,$3,'critical',$4,$5) on conflict(id) do nothing",
  [incidentId,o.component,at.toISOString(),o.code,o.detail]);
 if(event?.kind==="recovery")await sql.query("update public.litix_guardian_incidents set resolved_at=$2,last_seen_at=$2 where id=$1 and resolved_at is null",[event.id,at.toISOString()]);
 if(event?.kind==="escalation")await sql.query("update public.litix_guardian_incidents set last_seen_at=$2 where id=$1",[event.id,at.toISOString()]);
 if(event)await queueAlert(sql,o.component,event,event.id||incidentId,o,at);
}
// Injectable transport allows preview fault and recovery email tests without
// sending a real email. The production cron supplies the real Resend transport.
export async function deliverGuardianNotice({eventKey,payload,apiKey,transport=fetch}){
 const p=payload;
 const subject="LITIX Guardian "+(p.event==="recovery"?"RECOVERY":p.event==="escalation"?"ESCALATION":"OUTAGE")+" — "+p.component;
 const text=["Litix Guardian diagnostic alert","Time (UTC): "+p.time,"Component: "+p.component,"Event: "+p.event,
  "Code: "+p.code,"Details: "+p.detail,"Probable cause: "+p.probableCause,
  "Suggested repair: "+p.repair,"View protected dashboard: https://www.litix.net/guardian/admin",
  "No payment or order changes were performed."].join("\\n");
 const result=await transport("https://api.resend.com/emails",{method:"POST",
  headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json","idempotency-key":eventKey},
  body:JSON.stringify({from:"Litix Guardian <orders@litix.net>",to:["Litixsocial@gmail.com"],subject,text}),
  cache:"no-store",signal:AbortSignal.timeout(8000)});
 return result.ok;
}
async function sendQueuedAlerts(sql){
 if(process.env.VERCEL_ENV!=="production")return {sent:0,disabled:"preview"};
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!key)return {sent:0,disabled:"resend_not_configured"};
 // Atomic claim prevents competing workers sending the same alert simultaneously.
 const rows=await sql.query("update public.litix_guardian_alert_outbox set status='sending',attempts=attempts+1,last_attempt_at=now() where event_key in (select event_key from public.litix_guardian_alert_outbox where status='pending' or (status='sending' and last_attempt_at<now()-interval '3 minutes') order by created_at limit 10 for update skip locked) returning event_key,payload");
 let sent=0;
 for(const entry of rows){
  const p=entry.payload;
  try{
   const success=await deliverGuardianNotice({eventKey:entry.event_key,payload:p,apiKey:key});
   if(!success)throw Error("EMAIL_DELIVERY_FAILED");
   await sql.query("update public.litix_guardian_alert_outbox set status='sent',sent_at=now() where event_key=$1",[entry.event_key]);sent++;
  }catch(e){
   await sql.query("update public.litix_guardian_alert_outbox set status='pending' where event_key=$1",[entry.event_key]);
   console.error("Litix Guardian delivery queued for retry",{component:p.component,code:"ALERT_SEND_UNAVAILABLE"});
  }
 }
 return {sent};
}
export async function runGuardianCycle({sql=guardianDb(),now=new Date(),observations=null,sendAlerts=true}={}){
 const at=now instanceof Date?now:new Date(now);
 const previous=await sql.query("select * from public.litix_guardian_components");
 const current=Object.fromEntries(previous.map(x=>[x.component,x]));
 const checked=observations||await performGuardianChecks(sql,current,at);
 // These observations intentionally contain no customer identifiers or credentials.
 for(const o of checked)await persistObservation(sql,o,at);
 const delivery=sendAlerts?await sendQueuedAlerts(sql):{sent:0,disabled:"test"};
 const id="gr_"+randomUUID();
 await sql.query("insert into public.litix_guardian_runs(id,component_count,unhealthy_count,diag,finished_at) values($1,$2,$3,$4::jsonb,now())",
  [id,checked.length,checked.filter(x=>!x.ok).length,JSON.stringify({codes:checked.map(x=>({component:x.component,code:x.code,ok:x.ok}))})]);
 return {runId:id,checked:checked.length,failures:checked.filter(x=>!x.ok).length,delivery};
}
export const bearerAuthorized=(req,key)=>{
 const got=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!key||key.length<24||!got||got.length>512)return false;
 const a=createHash("sha256").update(got).digest(),b=createHash("sha256").update(key).digest();
 return timingSafeEqual(a,b);
};
