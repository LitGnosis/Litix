// Litix-owned-only purchase boundary. Historical payment, customer receipts,
// cancellations, and tracking live in separate read-only endpoints.
// Do not send customers to a retired third-party supplier or charge for
// engagement that has not been verified on a signed first-party delivery node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "same_origin_required", chargeAttempted: false }, {status: 403});
  }
  return Response.json({
    error: "Litix-owned fulfillment is not verified for this legacy engagement package. No payment was attempted.",
    code: "FIRST_PARTY_SERVICE_NOT_ENABLED",
    checkoutEnabled: false,
    chargeAttempted: false,
    supplierApiCalled: false,
    directServicesUrl: "/direct-services"
  }, {status: 409, headers: {"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
