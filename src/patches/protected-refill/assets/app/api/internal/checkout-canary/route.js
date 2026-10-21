/**
 * Preview-only, authenticated, NO-CHARGE smoke route.
 * Do not move this route to /api/checkout or call gateway/supplier write endpoints.
 */
import { NextResponse } from 'next/server';
import { getServiceById } from '../../../../lib/provider';
import { runMockCheckout } from '../../../../lib/litixRefillPolicy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const secret = process.env.LITIX_MOCK_TEST_SECRET;
  if (!secret || secret.length < 32 || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const input = await request.json();
    // This is an explicit supplier ID lookup, resolved against the live read-only catalog.
    const supplierId = String(input?.serviceId ?? '');
    if (!/^smmglob:\d{1,10}$/.test(supplierId)) {
      return NextResponse.json({ error: 'Expected SmmGlob supplier ID' }, { status: 400 });
    }
    const service = await getServiceById(supplierId);
    if (!service || service.refillTermDays !== 365) {
      return NextResponse.json({ error: 'Unavailable protected service' }, { status: 422 });
    }
    const quantity = Number(input?.quantity);
    const rawService = {
      service: service.providerServiceId,
      category: service.platform,
      name: `${service.name} [${service.refillTermDays} days refill]`, // derived only for the synthetic policy test
      refill: service.refill,
      rate: service.providerRateUsd,
      min: service.min,
      max: service.max
    };
    const result = runMockCheckout({
      rawService,
      network: service.platform,
      quantity,
      paymentToken: 'litix_mock_token_internal_9921'
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.warn('litix_mock_preflight_rejected', String(error?.message ?? 'invalid input').slice(0,130));
    return NextResponse.json({ error: 'Invalid mock checkout request' }, { status: 400 });
  }
}
