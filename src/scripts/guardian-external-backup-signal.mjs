// Read-only external R2 watchdog. Only full scheduled backups and isolated
// restores count as healthy; successful probe-only runs do not.
export function backupSignal(response,at=new Date()){
 const runs=Array.isArray(response?.workflow_runs)?response.workflow_runs:[];
 const scheduled=runs.filter(x=>x?.event==="schedule").sort((a,b)=>
  Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
 const latest=scheduled[0];
 if(!latest)return {ok:false,code:"R2_SCHEDULED_RUN_MISSING"};
 const age=at.getTime()-Date.parse(latest.created_at);
 if(!Number.isFinite(age)||age<0||age>36*60*60*1000)
  return {ok:false,code:"R2_SCHEDULE_STALE"};
 if(latest.status!=="completed")return {ok:false,code:"R2_BACKUP_RUNNING_OR_STALLED"};
 if(latest.conclusion!=="success")return {ok:false,code:"R2_BACKUP_NOT_VERIFIED"};
 return {ok:true,code:"R2_LATEST_SCHEDULED_RESTORE_PASS"};
}
