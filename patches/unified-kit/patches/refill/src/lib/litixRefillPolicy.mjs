/**
 * Shared Litix custom-service policy.
 * SmmGlob catalog prices are quoted per 1,000 units in USD.
 * This module does not authorize supplier charges or real card transactions.
 */
export const SUPPORTED_NETWORKS = Object.freeze(['Instagram', 'TikTok', 'YouTube']);
export const CUSTOM_RETAIL_MULTIPLIER = 8;

export function isSupportedNetwork(network) {
  return SUPPORTED_NETWORKS.includes(String(network ?? ''));
}

export function hasYearOrLongerCoverage(name) {
  const description = String(name ?? '');
  return /(?:\b365\s*(?:days?|d)\b|\br\s*365\b|\b12\s*months\b|\b1\s*year\b|\blife\s*time\b|\blifetime\b)/i.test(description);
}

export function supplierHasRefill(raw) {
  return raw?.refill === true || raw?.refill === 1 ||
    String(raw?.refill ?? '').trim().toLowerCase() === 'true';
}

export function isEligibleSupplierService(raw, network) {
  if (!isSupportedNetwork(network) || !supplierHasRefill(raw)) return false;
  return hasYearOrLongerCoverage(`${raw?.category ?? ''} ${raw?.name ?? raw?.service_name ?? ''}`);
}

export function retailQuoteCents(wholesaleRateUsdPerThousand, quantity) {
  const rate = Number(wholesaleRateUsdPerThousand);
  const amount = Number(quantity);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError('Valid positive rate and whole quantity required');
  }
  const cents = Math.round((rate * amount / 1000) * CUSTOM_RETAIL_MULTIPLIER * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new RangeError('Invalid retail price');
  return cents;
}

export function runMockCheckout({ rawService, network, quantity, paymentToken }) {
  if (!isEligibleSupplierService(rawService, network)) throw new Error('Service not 365-day-refill eligible');
  const min = Number(rawService.min);
  const max = Number(rawService.max);
  if (!Number.isSafeInteger(quantity) || quantity < min || quantity > max) {
    throw new RangeError('Quantity outside supplier limits');
  }
  // Only an internally generated synthetic token is accepted. No gateway call is made.
  if (paymentToken !== 'litix_mock_token_internal_9921') throw new Error('Invalid synthetic test token');
  const retailCents = retailQuoteCents(rawService.rate, quantity);
  return Object.freeze({
    success: true,
    mock: true,
    simulatedTokenizationCallback: true,
    network,
    supplierServiceId: String(rawService.service ?? rawService.id),
    quantity,
    retailCents,
    currency: 'USD',
    multiplier: CUSTOM_RETAIL_MULTIPLIER,
    supplierRefillTermDays: 365,
    gatewayNetworkCalled: false,
    cardCharged: false,
    paymentSettled: false,
    supplierNetworkCalled: false,
    supplierOrderPlaced: false,
    fulfillmentCompleted: false,
    note: 'Policy and state-transition simulation only; not a live gateway or supplier verification.'
  });
}
