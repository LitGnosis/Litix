import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 25;

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" },
});

const products = {
  "creator-launch-kit": { name: "Creator Launch Kit", cents: 1900 },
  "social-growth-toolkit": { name: "Social Growth Toolkit", cents: 2900 },
  "agency-starter-pack": { name: "Agency Starter Pack", cents: 4900 },
};

const clean = (value, max = 254) => String(value ?? "").trim().slice(0, max);

function gatewayConfig() {
  const mode = process.env.LITIX_DIGITAL_GATEWAY_MODE;
  if (mode === "TEST") {
    return {
      mode,
      key: process.env.LITIX_DIGITAL_TEST_GATEWAY_KEY,
      url: process.env.LITIX_DIGITAL_TEST_GATEWAY_URL,
    };
  }
  if (mode === "PRODUCTION") {
    return {
      mode,
      key: process.env.LITIX_DIGITAL_PRODUCTION_GATEWAY_KEY,
      url: process.env.LITIX_DIGITAL_PRODUCTION_GATEWAY_URL,
    };
  }
  return null;
}

function validGateway(config) {
  if (!config?.key || !config?.url) return false;
  try {
    const url = new URL(config.url);
    if (url.protocol !== "https:") return false;
    if (config.mode === "PRODUCTION") return url.hostname === "paykings.transactiongateway.com";
    return config.mode === "TEST" && url.hostname !== "paykings.transactiongateway.com";
  } catch {
    return false;
  }
}

export async function POST(request) {
  if (process.env.LITIX_DIGITAL_SALES_ENABLED !== "true" || process.env.LITIX_DIGITAL_PRICING_APPROVED !== "true" || process.env.LITIX_DIGITAL_TERMS_APPROVED !== "true" || process.env.LITIX_DIGITAL_ASSETS_APPROVED !== "true") {
    return json({ error: "Digital product checkout is not open yet." }, 503);
  }

  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin) {
    try {
      if (new URL(origin).origin !== requestUrl.origin) return json({ error: "Request origin is not allowed." }, 403);
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid checkout request." }, 400);
  }

  const productId = clean(input.productId, 64);
  const product = products[productId];
  const email = clean(input.email, 254).toLowerCase();
  const paymentToken = clean(input.paymentToken, 500);
  const idempotencyKey = clean(input.idempotencyKey, 36);
  if (!product) return json({ error: "Choose a valid digital product." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (paymentToken.length < 10 || !/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
    return json({ error: "Secure payment fields need to be completed. Please retry checkout." }, 400);
  }

  const databaseUrl = process.env.LITIX_DIGITAL_DATABASE_URL;
  const gateway = gatewayConfig();
  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!databaseUrl || !validGateway(gateway) || !resendKey || !emailFrom) {
    return json({ error: "Secure checkout is not configured. No charge was submitted." }, 503);
  }

  const sql = neon(databaseUrl);
  try {
    const assets = await sql.query(
      "select product_id from litix_digital_assets where product_id = $1 and is_active = true limit 1",
      [productId],
    );
    if (!assets.length) return json({ error: "The downloadable product bundle is not ready. No charge was submitted." }, 503);

    const orderId = "ltxd_" + randomUUID();
    const entitlementToken = randomBytes(32).toString("hex");
    const entitlementTokenHash = createHash("sha256").update(entitlementToken).digest("hex");
    const inserted = await sql.query(
      "insert into litix_digital_orders (id,email,product_id,product_name,amount_cents,idempotency_key,payment_gateway,entitlement_token_hash,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) on conflict (idempotency_key) do nothing returning id",
      [orderId, email, productId, product.name, product.cents, idempotencyKey, "paykings-nmi", entitlementTokenHash, JSON.stringify({ gatewayMode: gateway.mode, assetVersionChecked: true })],
    );
    if (!inserted.length) return json({ error: "This checkout was already submitted. Check your email or contact support; do not submit it again." }, 409);

    await sql.query("update litix_digital_orders set payment_state='processing', updated_at=now() where id=$1", [orderId]);

    let payment;
    try {
      const response = await fetch(gateway.url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          security_key: gateway.key,
          type: "sale",
          payment_token: paymentToken,
          amount: (product.cents / 100).toFixed(2),
          orderid: orderId,
          email,
        }),
        signal: AbortSignal.timeout(18000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Gateway HTTP failure");
      payment = Object.fromEntries(new URLSearchParams(await response.text()));
    } catch {
      await sql.query("update litix_digital_orders set payment_state='review', fulfillment_state='review', updated_at=now() where id=$1", [orderId]).catch(() => {});
      return json({ orderId, payment: "review", message: "Payment outcome is uncertain. Do not retry or submit another order; contact support for reconciliation." }, 202);
    }

    if (String(payment.response) === "2") {
      await sql.query("update litix_digital_orders set payment_state='declined', updated_at=now() where id=$1", [orderId]).catch(() => {});
      return json({ error: "Payment declined: " + clean(payment.responsetext || "Please contact your card issuer", 100) }, 402);
    }
    if (String(payment.response) !== "1") {
      await sql.query("update litix_digital_orders set payment_state='review', fulfillment_state='review', updated_at=now() where id=$1", [orderId]).catch(() => {});
      return json({ orderId, payment: "review", message: "The gateway response could not confirm the payment outcome. Do not retry or submit another order; contact support for reconciliation." }, 202);
    }

    const transactionId = clean(payment.transactionid, 120);
    if (!transactionId) {
      await sql.query("update litix_digital_orders set payment_state='review', fulfillment_state='review', updated_at=now() where id=$1", [orderId]).catch(() => {});
      return json({ orderId, payment: "review", message: "The gateway approval needs reconciliation before download access can be issued. Do not retry." }, 202);
    }

    try {
      await sql.query(
        "update litix_digital_orders set payment_state='paid', fulfillment_state='ready', payment_transaction_id=$2, paid_at=now(), entitlement_expires_at=now() + interval '30 days', updated_at=now() where id=$1",
        [orderId, transactionId],
      );
    } catch {
      return json({ orderId, payment: "review", message: "The gateway approved payment, but order confirmation needs manual reconciliation. Do not retry." }, 202);
    }

    const baseUrl = (process.env.SITE_URL || "https://litix.net").replace(/\/$/, "");
    const downloadUrl = baseUrl + "/api/digital-products/download?token=" + entitlementToken;
    let receiptSent = false;
    try {
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: "Bearer " + resendKey, "content-type": "application/json" },
        body: JSON.stringify({
          from: emailFrom,
          to: [email],
          subject: "Your Litix digital product is ready",
          text: "Your payment was approved for " + product.name + ". Download your ZIP bundle within 30 days, up to 5 times: " + downloadUrl + "\n\nIf you need help, contact Litix support.",
          html: "<div style=\"font-family:Arial,sans-serif;line-height:1.7;color:#111827\"><h2>Your Litix digital product is ready.</h2><p>Your payment was approved for <strong>" + product.name + "</strong>.</p><p><a href=\"" + downloadUrl + "\">Download your product bundle</a></p><p>The link expires in 30 days and allows up to 5 downloads. Keep it private because it grants access to your purchase.</p></div>",
        }),
        signal: AbortSignal.timeout(7000),
        cache: "no-store",
      });
      receiptSent = mail.ok;
    } catch {}

    return json({
      ok: true,
      orderId,
      payment: "paid",
      fulfillment: "ready",
      downloadUrl,
      receiptSent,
      message: receiptSent
        ? "Payment approved. Your download link was emailed to you."
        : "Payment approved. Save your download link now; the receipt email could not be sent.",
    });
  } catch (error) {
    console.error("Digital product checkout failed", String(error?.message || "database error").slice(0, 120));
    return json({ error: "Checkout is temporarily unavailable. If a payment may have been submitted, do not retry; contact support." }, 503);
  }
}
