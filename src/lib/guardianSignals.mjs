// Deterministic Guardian signals. Safe to exercise without payment credentials.
export const BOOSTERO_MIN_WALLET_USD=50;
const count=x=>Number.isSafeInteger(Number(x))&&Number(x)>=0?Number(x):null;
export function boosteroBalanceSignal(response){
 const balance=Number(response?.balance);
 if(response?.balance===null||response?.balance===undefined||String(response.balance).trim()===""||!Number.isFinite(balance)||balance<0)
  return {ok:false,code:"BOOSTERO_BALANCE_INVALID",detail:"Supplier balance response could not be verified"};
 if(balance<BOOSTERO_MIN_WALLET_USD)
  return {ok:false,code:"BOOSTERO_WALLET_LOW",detail:"Boostero wallet below $50 operating threshold; top-up may be required"};
 return {ok:true,code:"BOOSTERO_API_AND_WALLET_READY",detail:"Active Boostero API responds; wallet meets operational threshold"};
}
export function multiPostHealthSignal(raw){
 const stale=count(raw?.stale),unresolved=count(raw?.unresolved),queued=count(raw?.queued);
 if([stale,unresolved,queued].some(x=>x===null))
  return {ok:false,code:"MULTIPOST_HEALTH_INVALID",detail:"Could not verify paid multi-post order states"};
 if(unresolved>0)return {ok:false,code:"MULTIPOST_REQUIRES_RECONCILIATION",detail:unresolved+" existing child orders require manual supplier reconciliation"};
 if(queued>0)return {ok:false,code:"MULTIPOST_DISPATCH_DELAYED",detail:queued+" paid child orders have waited too long in queue"};
 if(stale>0)return {ok:false,code:"MULTIPOST_STATUS_STALE",detail:stale+" accepted child order statuses are overdue for read-only refresh"};
 return {ok:true,code:"MULTIPOST_RECONCILED",detail:"Paid multi-post ledger has no stale, unresolved or delayed children"};
}
export function deliveryNotificationSignal(raw){
 const customer=count(raw?.customer),guardian=count(raw?.guardian);
 if(customer===null||guardian===null)return {ok:false,code:"NOTIFICATION_HEALTH_INVALID",detail:"Notification backlog counts could not be verified"};
 if(customer>0||guardian>0)
  return {ok:false,code:"EMAIL_OUTBOX_BACKLOG",detail:"Delayed messages in Litix email outbox; customer "+customer+", Guardian "+guardian};
 return {ok:true,code:"EMAIL_OUTBOX_CLEAR",detail:"Customer and Guardian email outboxes have no overdue notices"};
}
export function regularOrderHealthSignal(raw){
 const stale=count(raw?.stale);
 if(stale===null)return {ok:false,code:"FULFILLMENT_HEALTH_INVALID",detail:"Order fulfillment freshness check unavailable"};
 return stale>0?{ok:false,code:"ORDER_STATUS_STALE",detail:stale+" single-order supplier statuses are overdue"}
  :{ok:true,code:"FULFILLMENT_LEDGER",detail:"Confirmed supplier single-order status records are current"};
}
