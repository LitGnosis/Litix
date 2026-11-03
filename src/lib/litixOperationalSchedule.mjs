// Deterministic five-minute phase assignment for independent supplier work.
// No persistent state, no supplier actions, and no credentials in this module.
export const boosteroCronPhase=(at=Date.now())=>{
 const time=Number(at);
 if(!Number.isFinite(time)||time<0)throw Error("LITIX_CRON_TIME_INVALID");
 return Math.floor(time/300000)%3;
};
export const BOOSTERO_CRON_PHASE_LABELS=Object.freeze([
 "regular_delivery","multi_post_delivery","paid_multi_post_continuation"
]);
