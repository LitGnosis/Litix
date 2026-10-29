import { createHash } from "node:crypto";
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

  // Honeypot: respond as if accepted to avoid revealing the bot check.
  if (String(input.website ?? "").trim()) {
    return json({ ok: true });
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

  // Isolated database only: never fall back to the social-growth production database.
  const databaseUrl = process.env.LITIX_DIGITAL_DATABASE_URL;
  if (!databaseUrl) {
    return json({ error: "Early access signup is being prepared. Please try again later." }, 503);
  }

  const sql = neon(databaseUrl);
  const emailHash = createHash("sha256").update(email).digest("hex");
  try {
    const recent = await sql.query(
      "select count(*)::int as count from litix_digital_waitlist where email_hash = $1 and created_at > now() - interval '1 hour'",
      [emailHash],
    );
    if (Number(recent[0]?.count ?? 0) >= 3) {
      return json({ error: "Too many signup attempts. Please try again later." }, 429);
    }

    await sql.query(
      "insert into litix_digital_waitlist (email, email_hash, product_interest, consent_at, source) values ($1, $2, $3, now(), 'digital-products') on conflict (email_hash) do update set product_interest = excluded.product_interest, consent_at = excluded.consent_at, updated_at = now()",
      [email, emailHash, productInterest],
    );
    return json({ ok: true, message: "You're on the early-access list. We'll contact you when the collection is ready." });
  } catch (error) {
    console.error("Digital product early-access signup failed", String(error?.message ?? "database error").slice(0, 120));
    return json({ error: "We couldn't save your signup right now. Please try again later." }, 503);
  }
}
