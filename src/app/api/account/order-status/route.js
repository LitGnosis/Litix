import { neon } from "@neondatabase/serverless";
import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const send = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
const connection = () =>
  process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL ||
  process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const validOrderId = id => /^ltx2_[a-f0-9-]{36}$/.test(id);
const normalizeSupplierState = (raw, current) => {
  const s = String(raw || "").trim().toLowerCase().replace(/[ _-]+/g, " ");
  if (["completed", "complete", "finished"].includes(s)) return "completed";
  if (["partial", "partially completed"].includes(s)) return "partial";
  if (["canceled", "cancelled", "refunded", "failed", "error"].includes(s)) return s === "cancelled" ? "canceled" : s;
  if (["in progress", "inprogress", "working"].includes(s)) return "in_progress";
  if (["processing", "running"].includes(s)) return "processing";
  if (["pending", "waiting", "queued", "awaiting"].includes(s)) return "pending";
  return current;
};
const publicOrder = (order, refresh) => {
  const supplier = order.last_supplier_status || {};
  const remaining = supplier.remains == null ? null : Number(supplier.remains);
  const remains = Number.isInteger(remaining) && remaining >= 0 && remaining <= Number(order.quantity) ? remaining : null;
  return {
    id: order.id,
    service: order.service_name,
    quantity: Number(order.quantity),
    amount: (Number(order.amount_cents) / 100).toFixed(2),
    payment: order.payment_state,
    fulfillment: order.fulfillment_state,
    supplierOrderId: order.supplier_order_id || null,
    status: String(supplier.status || "").trim() || null,
    remains,
    checkedAt: supplier.checked_at || null,
    liveSupplierStatus: refresh.live === true,
    deliveryConfirmed: order.fulfillment_state === "completed",
    statusNote: refresh.warning || (!supplier.status
      ? "Supplier accepted the order; delivery is not confirmed yet."
      : "Supplier status is based on its most recent response.")
  };
};

async function refreshStatus(sql, order, email) {
  if (!order.supplier_order_id) return { live: false, warning: "Waiting for supplier order assignment." };
  const last = Date.parse(String(order.last_supplier_status?.checked_at || ""));
  if (Number.isFinite(last) && Date.now() - last < 60_000) {
    return { live: false, warning: "Showing a supplier update fetched within the last minute." };
  }
  // Only a read-only supplier status query is permitted here: never send an add/order request.
  if (!/^\d{1,24}$/.test(String(order.supplier_order_id))) {
    return { live: false, warning: "Supplier reference needs support review." };
  }
  try {
    const url = new URL(process.env.SMMGLOB_API_URL || "https://smmglob.com/api/v2");
    if (url.protocol !== "https:" || !["smmglob.com", "www.smmglob.com"].includes(url.hostname) || !process.env.SMMGLOB_API_KEY) {
      throw Error("Supplier status is not configured");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: process.env.SMMGLOB_API_KEY, action: "status", order: String(order.supplier_order_id) }),
      signal: AbortSignal.timeout(16_000),
      cache: "no-store"
    });
    if (!response.ok) throw Error("Supplier status temporarily unavailable");
    const body = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || body.error) throw Error("Invalid supplier status");
    const next = { ...body, checked_at: new Date().toISOString() };
    const newState = normalizeSupplierState(next.status, order.fulfillment_state);
    await sql.query(
      "update litix_v2_orders set last_supplier_status=$3::jsonb,fulfillment_state=$4 where id=$1 and lower(email)=$2 and supplier_order_id=$5",
      [order.id, email, JSON.stringify(next), newState, order.supplier_order_id]
    );
    order.last_supplier_status = next;
    order.fulfillment_state = newState;
    return { live: true };
  } catch {
    return { live: false, warning: "Latest supplier update is temporarily unavailable. Previous order status is shown." };
  }
}

export async function GET(request) {
  if (!customerAuthConfigured()) return send({ error: "Customer accounts are not enabled." }, 503);
  const user = await authenticatedCustomer();
  if (!user) return send({ error: "Sign in with a verified email to track your order." }, 401);
  const orderId = new URL(request.url).searchParams.get("id") || "";
  if (!validOrderId(orderId)) return send({ error: "Invalid Litix order number." }, 400);
  if (!connection()) return send({ error: "Order tracking is temporarily unavailable." }, 503);
  try {
    const sql = neon(connection());
    const rows = await sql.query(
      "select id,service_name,quantity,amount_cents,payment_state,fulfillment_state,supplier_order_id,last_supplier_status from litix_v2_orders where id=$1 and lower(email)=$2 limit 1",
      [orderId, user.email]
    );
    // Return the same response for an unknown order and an order belonging to another customer.
    if (!rows.length) return send({ error: "Order not found in your account." }, 404);
    const order = rows[0];
    const refresh = await refreshStatus(sql, order, user.email);
    return send({ order: publicOrder(order, refresh) });
  } catch {
    return send({ error: "Order tracking is temporarily unavailable." }, 503);
  }
}
