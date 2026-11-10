import { NextResponse } from 'next/server';
import { processVerifiedPayment } from '../../../../lib/payments/ingest';
import { normalizeNmiEvent, normalizeStripeEvent } from '../../../../lib/payments/normalize';
import { readLimitedBody, selectProvider, verifyNmiMerchantWebhook, verifyStripeWebhook } from '../../../../lib/payments/signatures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function POST(request: Request) {
  if (process.env.LITIX_PAYMENT_WEBHOOK_ENABLED !== 'true') return reply({ error: 'unavailable' }, 503);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return reply({ error: 'invalid_content_type' }, 415);
  }
  const provider = selectProvider(request.headers);
  if (!provider) return reply({ error: 'missing_or_ambiguous_signature' }, 400);
  const secret = provider === 'nmi' ? process.env.NMI_MERCHANT_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.length < 24) return reply({ error: 'provider_unconfigured' }, 503);

  let rawBody: string;
  try { rawBody = await readLimitedBody(request); }
  catch { return reply({ error: 'invalid_body' }, 413); }

  const verified = provider === 'nmi'
    ? verifyNmiMerchantWebhook(rawBody, request.headers.get('webhook-signature'), secret)
    : verifyStripeWebhook(rawBody, request.headers.get('stripe-signature'), secret);
  if (!verified) return reply({ error: 'invalid_signature' }, 401);

  let normalized;
  try {
    const data: unknown = JSON.parse(rawBody);
    normalized = provider === 'nmi' ? normalizeNmiEvent(data) : normalizeStripeEvent(data);
  } catch { return reply({ error: 'invalid_payload' }, 400); }
  if (!normalized) return reply({ error: 'unsupported_event' }, 422);
  if (!normalized.liveMode && process.env.LITIX_ALLOW_TEST_WEBHOOKS !== 'true') {
    return reply({ received: true, live: false }, 200);
  }
  if (provider === 'nmi' && normalized.merchantId !== process.env.NMI_MERCHANT_ID) {
    return reply({ error: 'merchant_mismatch' }, 401);
  }

  try {
    const result = await processVerifiedPayment(normalized);
    return reply({ received: true, state: result }, 200);
  } catch (error) {
    console.error('litix_payment_webhook_persist_failed', { provider, type: normalized.eventType,
      code: error instanceof Error ? error.name : 'UNKNOWN' });
    return reply({ error: 'retry_later' }, 503);
  }
}
