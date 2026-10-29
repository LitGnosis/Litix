// Pricing candidates only: NEVER auto-approve, charge, or change completed orders.
// A 2.5x supplier multiplier may conflict with previously approved Litix margin floors.
export const BOOSTERO_RETAIL_MULTIPLIER = 2.5;
export const MIN_RETAIL_PER_1000_CENTS = 500;
function dollarsToCents(x) { return Math.ceil(x * 100 - 1e-8); }
export function boosteroRetailCandidate(wholesalePer1000, {maxPer1000Cents = null} = {}) {
  const cost = Number(wholesalePer1000);
  if (!Number.isFinite(cost) || cost <= 0 || cost > 1000000)
    return {retailCents: null, reviewReason: "invalid_wholesale_rate"};
  const retailCents = Math.max(MIN_RETAIL_PER_1000_CENTS, dollarsToCents(cost * BOOSTERO_RETAIL_MULTIPLIER));
  // Existing tiered wholesale protections must not silently be weakened.
  const legacyFloorMultiplier = cost < 1 ? 8 : cost < 20 ? 5 : 2;
  const priorMarginFloor = dollarsToCents(cost * legacyFloorMultiplier);
  let reviewReason = null;
  if (retailCents < priorMarginFloor) reviewReason = "existing_markup_floor_conflict";
  if (maxPer1000Cents !== null && (!Number.isSafeInteger(maxPer1000Cents) ||
      maxPer1000Cents < MIN_RETAIL_PER_1000_CENTS || retailCents > maxPer1000Cents))
    reviewReason = "approved_price_ceiling_conflict";
  return {retailCents, reviewReason};
}
