// Central supplier allowlist. Import at every catalog, checkout and fulfillment boundary.
// Do not infer supplier eligibility from names, historical metadata or client input.
export const ACTIVE_SUPPLIER = "BOOSTERO";
export const ACTIVE_ROUTING_TAG = "BOOSTERO_DIRECT";

export function requireBoostero(supplier) {
  if (typeof supplier !== "string" || supplier.toUpperCase() !== ACTIVE_SUPPLIER) {
    throw new Error("Supplier routing is not permitted");
  }
  return ACTIVE_SUPPLIER;
}

export function verifiedBoosteroService(service) {
  return Boolean(
    service &&
    service.supplier === ACTIVE_SUPPLIER &&
    service.verified === true &&
    service.active === true &&
    Number.isSafeInteger(Number(service.serviceId)) &&
    Number(service.serviceId) > 0 &&
    Number.isFinite(Number(service.retailPrice)) &&
    Number(service.retailPrice) > 0
  );
}
