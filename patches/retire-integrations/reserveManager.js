// Automatic reserve payouts are unavailable until a supported payout rail is configured.
export const reserveRouteCapable=()=>false;
export const supplierReserveConfig=providerId=>({providerId,ready:false});
export const reserveSummary=(ids=[])=>ids.map(provider=>({provider,enabled:false,addressConfigured:false,payoutConfigured:false,ready:false}));
export async function ensureSupplierReserve(){return {ok:false,status:'not_configured'};}
