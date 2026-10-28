// Pure, deterministic incident state machine. No network calls, credentials or customer data.
export const failureThreshold=2, recoveryThreshold=2, escalateAfterMs=60*60*1000;
export const safeCode=v=>String(v||"UNKNOWN").toUpperCase().replace(/[^A-Z0-9_]/g,"_").slice(0,48);
export const componentKeys=Object.freeze(["website","boostero","catalog","tiktok","instagram","paykings_readiness","bluevine_readiness","autolikes","subscriptions","orders","fulfillment","database","resend"]);
export function nextGuardianState(prior,observation,at=new Date()){
 const now=at instanceof Date?at:new Date(at);
 const prev={status:"unknown",consecutive_failures:0,consecutive_successes:0,active_incident_id:null,alert_at:null,escalation_at:null,...(prior||{})};
 const result={...prev,status:prev.status,consecutive_failures:prev.consecutive_failures,consecutive_successes:prev.consecutive_successes,checked_at:now.toISOString()};
 const events=[];
 if(observation.kind==="not_launched"){
  result.status="not_launched";result.consecutive_failures=0;result.consecutive_successes=0;
  return {next:result,events};
 }
 // A usable stale catalog is degraded, not a missing/failed catalog.
 // Clear a previously confirmed outage only after two consecutive usable reads.
 if(observation.kind==="degraded"&&observation.ok){
  result.status="degraded";
  result.consecutive_failures=0;result.consecutive_successes=prev.consecutive_successes+1;
  if(prev.active_incident_id&&result.consecutive_successes>=recoveryThreshold){
   events.push({kind:"recovery",id:prev.active_incident_id});
   result.active_incident_id=null;result.alert_at=null;result.escalation_at=null;
  }
  return {next:result,events};
 }
 if(observation.ok){
  result.consecutive_failures=0;result.consecutive_successes=prev.consecutive_successes+1;
  if(prev.active_incident_id){
   if(result.consecutive_successes>=recoveryThreshold){
    result.status="healthy";
    events.push({kind:"recovery",id:prev.active_incident_id});
    result.active_incident_id=null;result.alert_at=null;result.escalation_at=null;
   }else result.status="degraded";
  }else result.status="healthy";
 }else{
  result.consecutive_failures=prev.consecutive_failures+1;
  result.consecutive_successes=0;
  if(result.consecutive_failures>=failureThreshold){
   result.status="down";
   if(!prev.active_incident_id)events.push({kind:"outage"});
   else if(prev.alert_at&&now.getTime()-new Date(prev.alert_at).getTime()>=escalateAfterMs&&
      (!prev.escalation_at||now.getTime()-new Date(prev.escalation_at).getTime()>=escalateAfterMs)){
    events.push({kind:"escalation",id:prev.active_incident_id});
   }
  }else result.status="degraded";
 }
 return {next:result,events};
}
export const safeDiagnostic=(component,ok,code,detail="")=>({
 component,ok:!!ok,kind:"check",code:safeCode(code),
 detail:String(detail).replace(/[\r\n]/g," ").replace(/https?:\/\/\S+/g,"[url]").slice(0,150)
});
