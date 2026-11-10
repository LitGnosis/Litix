import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import {
  canTransition, fingerprint, normalizeEvidence, normalizeSourceId,
  parseSpec, secureEqual,
} from "../../../../native/fulfillment-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const reply = (data, status = 200) => Response.json(data, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
const connection = () => process.env.LITIX_V2_DATABASE_URL ||
  process.env.DATABASE_URL || process.env.POSTGRES_URL;
const database = () => neon(connection());

function authorized(request) {
  const expected = process.env.LITIX_NATIVE_FULFILLMENT_ADMIN_TOKEN || "";
  const header = request.headers.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return expected.length >= 32 && secureEqual(supplied, expected);
}

function gate(request) {
  if (process.env.LITIX_NATIVE_FULFILLMENT_ENABLED !== "true")
    return reply({ error: "Native work-order operations are disabled." }, 503);
  if (!authorized(request)) return reply({ error: "Unauthorized" }, 401);
  if (!connection()) return reply({ error: "Production database is not configured." }, 503);
  return null;
}

export async function GET(request) {
  const denied = gate(request); if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  try {
    const sql = database();
    if (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "Invalid work-order ID." }, 400);
      const rows = await sql.query(
        `select id,source_order_id,spec_json,state,operator_reference,approval_reference,evidence_url,
          review_reason,created_at,updated_at from litix_native_work_orders where id=$1::uuid`,
        [id]
      );
      return rows.length ? reply({ order: rows[0] }) : reply({ error: "Not found" }, 404);
    }
    const rows = await sql.query(
      `select id,source_order_id,spec_json,state,operator_reference,approval_reference,evidence_url,
        review_reason,created_at,updated_at from litix_native_work_orders
       order by created_at desc limit 50`, []
    );
    return reply({ orders: rows, mode: "operator_review_only", autoDispatchEnabled: false });
  } catch (error) {
    console.error("Native fulfillment read failure", error instanceof Error ? error.name : "unknown");
    return reply({ error: "Native fulfillment ledger unavailable." }, 503);
  }
}

export async function POST(request) {
  const denied = gate(request); if (denied) return denied;
  if (Number(request.headers.get("content-length") || 0) > 16384)
    return reply({ error: "Body too large" }, 413);

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return reply({ error: "Body too large" }, 413);
    payload = JSON.parse(raw);
  } catch { return reply({ error: "Invalid JSON" }, 400); }

  const action = payload?.action;
  const sql = database();
  if (action === "stage") {
    const sourceOrderId = normalizeSourceId(payload.sourceOrderId);
    if (!sourceOrderId) return reply({ error: "Valid source order required." }, 400);
    let spec;
    try { spec = parseSpec(payload.spec); }
    catch (error) { return reply({ error: error.message }, 422); }

    try {
      // Payment verification is server-side; no client-supplied paid=true or amount is trusted.
      // Every job starts DRAFT, never dispatches itself, and is limited to human/content work.
      const paid = await sql.query(
        `select order_id from litix_paykings_checkout_orders
         where order_id=$1 and lower(payment_state)='settled'
           and upper(currency)='USD' and settled_at is not null limit 1`,
        [sourceOrderId]
      );
      if (!paid.length)
        return reply({ error: "Settled order not independently verified; no work staged." }, 409);

      const hash = fingerprint(sourceOrderId, spec);
      const result = await sql.query(
        `insert into litix_native_work_orders(id,source_order_id,spec_json,spec_hash,state)
         values ($1::uuid,$2,$3::jsonb,$4,'DRAFT')
         on conflict (source_order_id) do nothing
         returning id,source_order_id,state,spec_hash`,
        [randomUUID(), sourceOrderId, JSON.stringify(spec), hash]
      );
      if (result.length) return reply({ order: result[0], created: true, dispatched: false }, 201);
      const previous = await sql.query(
        `select id,source_order_id,state,spec_hash from litix_native_work_orders where source_order_id=$1`,
        [sourceOrderId]
      );
      if (previous[0]?.spec_hash !== hash)
        return reply({ error: "Source order already has a different work specification." }, 409);
      return reply({ order: previous[0], created: false, dispatched: false });
    } catch (error) {
      console.error("Native work staging failed", error instanceof Error ? error.name : "unknown");
      return reply({ error: "Staging unavailable. No upstream supplier request was sent." }, 503);
    }
  }

  const id = String(payload?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "Invalid work-order ID." }, 400);

  const requestedStates = {
    approve: ["DRAFT", "READY_FOR_OPERATOR"],
    start: ["READY_FOR_OPERATOR", "IN_PROGRESS"],
    complete: ["IN_PROGRESS", "DELIVERED"],
    review: ["READY_FOR_OPERATOR", "REVIEW_REQUIRED"],
    cancel: ["DRAFT", "CANCELLED"],
  };
  if (!requestedStates[action]) return reply({ error: "Unsupported action." }, 400);

  try {
    const rows = await sql.query("select state from litix_native_work_orders where id=$1::uuid", [id]);
    if (!rows.length) return reply({ error: "Not found" }, 404);
    const current = String(rows[0].state);
    const [expected, next] = requestedStates[action];
    if (current !== expected || !canTransition(current, next))
      return reply({ error: "Work order state has changed or transition is prohibited." }, 409);

    let result;
    if (action === "approve") {
      const operatorRef = String(payload.operatorReference || "").trim();
      const approvalRef = String(payload.approvalReference || "").trim();
      if (payload.scopeVerified !== true || payload.clientConsentVerified !== true ||
        operatorRef.length < 3 || operatorRef.length > 160 ||
        approvalRef.length < 5 || approvalRef.length > 160)
        return reply({ error: "Written approval, scope, operator and client consent must be independently verified." }, 422);
      result = await sql.query(
        `update litix_native_work_orders
         set state='READY_FOR_OPERATOR',operator_reference=$2,approval_reference=$3
         where id=$1::uuid and state='DRAFT' returning id,state`,
        [id, operatorRef, approvalRef]
      );
    } else if (action === "complete") {
      let evidence;
      try { evidence = normalizeEvidence(payload.evidenceUrl); }
      catch { return reply({ error: "Verified HTTPS delivery evidence is required." }, 422); }
      result = await sql.query(
        `update litix_native_work_orders set state='DELIVERED',evidence_url=$2
         where id=$1::uuid and state='IN_PROGRESS' returning id,state`,
        [id, evidence]
      );
    } else if (action === "review") {
      const reason = String(payload.reason || "").trim();
      if (reason.length < 6 || reason.length > 500) return reply({ error: "Review reason required." }, 422);
      result = await sql.query(
        `update litix_native_work_orders set state='REVIEW_REQUIRED',review_reason=$2
         where id=$1::uuid and state='READY_FOR_OPERATOR' returning id,state`,
        [id, reason]
      );
    } else {
      result = await sql.query(
        `update litix_native_work_orders set state=$2
         where id=$1::uuid and state=$3 returning id,state`,
        [id, next, expected]
      );
    }
    if (!result.length) return reply({ error: "State changed concurrently, no mutation performed." }, 409);
    return reply({ order: result[0], providerRequestSent: false, paymentChanged: false });
  } catch (error) {
    console.error("Native work transition failed", error instanceof Error ? error.name : "unknown");
    return reply({ error: "State update failed; no supplier request or payment change was made." }, 503);
  }
}
