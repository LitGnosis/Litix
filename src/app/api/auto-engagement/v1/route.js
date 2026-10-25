import { blockers, validateDraft } from '../../../../lib/auto-engagement.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const send = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export function GET() {
 return send({ state: 'draft_only', canPurchase: false, blockers });
}
export async function POST(request) {
 // No execution escape hatch, even if a caller supplies paymentVerified or action:add.
 let input;
 try {
  const raw = await request.text();
  if (raw.length > 4096) return send({ error: 'Draft request too large.' }, 413);
  input = JSON.parse(raw);
 } catch { return send({ error: 'Invalid JSON.' }, 400); }
 if (input?.executionAction !== 'validateDraft') return send({ error: 'Automatic purchasing is not enabled. No payment or supplier request was sent.', canPurchase: false }, 409);
 try { return send({ draft: validateDraft(input), message: 'Draft validated only. Not saved, paid, scheduled, or activated.' }); }
 catch (error) { return send({ error: error.message }, 422); }
}
