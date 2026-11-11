// Public readiness checks never expose bridge credentials or gateway diagnostics.
export async function checkPaymentReadiness(summary, fetcher = fetch) {
  if (!summary.ready) return {ready:false, reason:'payment_not_configured'};
  if (summary.mode !== 'paykings') return {ready:true, reason:null};
  try {
    const response = await fetcher('https://litix-paykings-webhook.vercel.app/api/payments/paykings/checkout-readiness', {
      cache:'no-store', signal:AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (response.ok && data.ready === true && data.customerChargesEnabled === true && data.merchantTestMode === false) {
      return {ready:true, reason:null};
    }
    return {ready:false, reason:data.merchantTestMode === true ? 'merchant_test_mode' : 'payment_verification_pending'};
  } catch {
    return {ready:false, reason:'payment_verification_unavailable'};
  }
}
export function displayOrderPrice(selected, quantity, speed) {
  const rate = Number(selected?.rateUsd), count = Number(quantity);
  if (!selected || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(count) || count <= 0) return '—';
  return new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(rate * count / 1000 * (speed === 'priority' ? 1.15 : 1));
}
