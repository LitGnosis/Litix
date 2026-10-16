import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { markPaidBySession, fulfillPaidOrder } from '../../../../lib/orders';

export const dynamic = 'force-dynamic';
export async function POST(req) {
  try {
    const sig = req.headers.get('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    const raw = await req.text();
    const event = stripe().webhooks.constructEvent(raw, sig, secret);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      if (String(session.id).startsWith('cs_test_')) {
        console.log('[litix:lifecycle]', JSON.stringify({ stage:'test_payment_ignored', sessionId:session.id }));
        return NextResponse.json({ received: true });
      }
      if (session.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded') {
        const order = await markPaidBySession(session.id, typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id);
        if (order) {
          console.log('[litix:lifecycle]', JSON.stringify({ stage:'payment_confirmed', orderId:order.id, sessionId:session.id }));
          await fulfillPaidOrder(order.id);
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('stripe_webhook_error', err?.message || err);
    return NextResponse.json({ error: 'Webhook rejected' }, { status: 400 });
  }
}
