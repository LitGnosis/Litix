import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });

const products = new Set([
  "creator-launch-kit",
  "social-growth-toolkit",
  "agency-starter-pack",
  "all",
]);

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin) {
    try {
      if (new URL(origin).origin !== requestUrl.origin) {
        return json({ error: "Request origin is not allowed." }, 403);
      }
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Please submit a valid form." }, 400);
  }

  const email = normalizeEmail(input.email);
  const productInterest = String(input.productInterest ?? "all");
  const consent = input.consent === true;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Enter a valid email address." }, 400);
  }
  if (!products.has(productInterest) || !consent) {
    return json({ error: "Choose a product interest and consent to receive launch updates." }, 400);
  }

  // Dedicated database only: never fall back to the social-growth production database.
  const databaseUrl = process.env.LITIX_DIGITAL_DATABASE_URL;
  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (process.env.LITIX_DIGITAL_WAITLIST_ENABLED !== "true" || !databaseUrl || !resendKey || !emailFrom) {
    return json({ error: "Early access signup is being prepared. Please try again later." }, 503);
  }

  const sql = neon(databaseUrl);
  const emailHash = createHash("sha256").update(email).digest("hex");
  const unsubscribeToken = randomBytes(32).toString("hex");
  const unsubscribeTokenHash = createHash("sha256").update(unsubscribeToken).digest("hex");
  let saved = false;

  try {
    const savedRows = await sql.query(
      "insert into litix_digital_waitlist (email, email_hash, product_interest, consent_at, unsubscribe_token_hash, source, unsubscribed_at) values ($1, $2, $3, now(), $4, 'digital-products', null) on conflict (email_hash) do update set email = excluded.email, product_interest = excluded.product_interest, consent_at = excluded.consent_at, unsubscribe_token_hash = excluded.unsubscribe_token_hash, unsubscribed_at = null, updated_at = now() where litix_digital_waitlist.updated_at < now() - interval '1 hour' returning id",
      [email, emailHash, productInterest, unsubscribeTokenHash],
    );
    if (!savedRows.length) {
      return json({ error: "This address was recently signed up. Please check your inbox before trying again." }, 429);
    }
    saved = true;

    const baseUrl = (process.env.SITE_URL || "https://litix.net").replace(/\/$/, "");
    const unsubscribeUrl = baseUrl + "/api/digital-products/unsubscribe?token=" + unsubscribeToken;
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + resendKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "You're on the Litix digital-products early-access list",
        text: "Thanks for your interest in Litix digital products. We'll send launch updates about the collection you selected.\n\nIf you didn't request this, or you no longer want updates, unsubscribe here: " + unsubscribeUrl,
        html: "<div style=\"font-family:Arial,sans-serif;line-height:1.7;color:#111827\"><h2>You're on the Litix early-access list.</h2><p>Thanks for your interest in the Litix digital-product collection. We'll send launch updates about the collection you selected.</p><p>If you didn't request this or no longer want updates, <a href=\"" + unsubscribeUrl + "\">unsubscribe here</a>.</p></div>",
      }),
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!emailResponse.ok) throw new Error("Launch confirmation email could not be sent");

    return json({ ok: true, message: "You're on the early-access list. Check your inbox for confirmation." });
  } catch (error) {
    if (saved) {
      await sql.query("delete from litix_digital_waitlist where email_hash = $1 and unsubscribe_token_hash = $2", [emailHash, unsubscribeTokenHash]).catch(() => {});
    }
    console.error("Digital product early-access signup failed", String(error?.message ?? "service error").slice(0, 120));
    return json({ error: "We couldn't confirm your signup right now. Please try again later." }, 503);
  }
}
