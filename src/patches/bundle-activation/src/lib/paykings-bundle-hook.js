// Internal consumer only. Keep the existing signed NMI webhook receiver unchanged.
// This module must never accept a browser assertion or raw webhook as proof of payment.
export async function processSettledBundleOrder(id, {repository, fulfill}={}) {
  if (!repository || !fulfill) throw new Error('Bundle integration not configured');
  if (typeof id!=='string' || !/^ltx_[a-zA-Z0-9_-]+$/.test(id)) return {success:false,code:'INVALID_ORDER'};
  if (!await repository.verifySettledPayment(id)) return {success:false,code:'SETTLEMENT_NOT_VERIFIED'};
  return fulfill(id);
}
