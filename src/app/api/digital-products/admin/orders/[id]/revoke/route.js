import { createHash, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

function authorized(request) {
  const expected = process.env.LITIX_DIGITAL_ASSET_ADMIN_TOKEN || "";
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!expected || !match) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(match[1]);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request, context) {
  if (process.env.LITIX_DIGITAL_ADMIN_ACTIONS_ENABLED !== "true") {
    return json({ error: "Digital order administration is disabled." }, 503);
  }
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);

  const { id } = await context.params;
  if (!/^ltxd_[a-f0-9-]{36}$/i.test(String(id || ""))) return json({ error: "Invalid order ID." }, 400);

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const action = String(input.action || "");
  const gatewayEventId = String(input.gatewayEventId || "").trim().slice(0, 120);
  if (!["refund", "chargeback"].includes(action)) {
    return json({ error: "Choose a verified refund or chargeback action." }, 400);
  }

  const databaseUrl = process.env.LITIX_DIGITAL_DATABASE_URL;
  if (!databaseUrl) return json({ error: "Digital-products database is not configured." }, 503);
  const sql = neon(databaseUrl);

  try {
    const orders = await sql.query(
      "select id, payment_state from litix_digital_orders where id = $1 limit 1",
      [id],
    );
    const order = orders[0];
    if (!order) return json({ error: "Order not found." }, 404);
    if (!["paid", "partially_refunded"].includes(order.payment_state)) {
      return json({ error: "Only a paid order can be revoked. Reconcile any uncertain payment first." }, 409);
    }

    const nextState = action === "refund" ? "refunded" : "partially_refunded";
    await sql.query(
      "update litix_digital_orders set payment_state=$2, fulfillment_state='revoked', refunded_at=now(), updated_at=now() where id=$1",
      [id, nextState],
    );
    const digest = createHash("sha256").update(JSON.stringify({ orderId: id, action, gatewayEventId })).digest("hex");
    await sql.query(
      "insert into litix_digital_payment_events (order_id,gateway_event_id,event_type,outcome,payload_digest,metadata) values ($1,$2,$3,'accepted',$4,$5::jsonb) on conflict do nothing",
      [id, gatewayEventId || null, action === "refund" ? "refund_access_revoked" : "chargeback_access_revoked", digest, JSON.stringify({ action, source: "authorized-admin" })],
    ).catch(() => {});
    return json({ ok: true, orderId: id, paymentState: nextState, fulfillmentState: "revoked" });
  } catch (error) {
    console.error("Digital order revocation failed", String(error?.message || "database error").slice(0, 120));
    return json({ error: "Order access could not be revoked right now." }, 503);
  }
}
