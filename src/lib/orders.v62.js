import { db, audit } from './db';
import { submitProviderOrder, getProviderOrderStatus, getProviderBalance, providerCostNgn } from './provider';

export async function createOrder({ id, service, target, quantity, providerCost, providerCostUsd, retailCents, email }) {
  const sql = db();
  await sql`
    insert into litix_supplier_orders (
      id, service_id, service_name, target_link, quantity,
      provider_currency, provider_rate, provider_cost, provider_cost_usd,
      retail_cents, markup, customer_email,
      payment_status, fulfillment_status, created_at, updated_at
    ) values (
      ${id}, ${service.id}, ${service.name}, ${target}, ${quantity},
      'NGN', ${service.providerRate}, ${providerCost}, ${providerCostUsd},
      ${retailCents}, ${service.retailRateUsd / service.providerRateUsd}, ${email},
      'pending', 'pending', now(), now()
    )
  `;
  return id;
}

export async function attachStripeSession(orderId, sessionId) {
  const sql = db();
  await sql`update litix_supplier_orders set stripe_session_id=${sessionId}, updated_at=now() where id=${orderId}`;
}

export async function markPaidBySession(sessionId, paymentIntent) {
  const sql = db();
  const rows = await sql`
    update litix_supplier_orders
    set payment_status='paid', stripe_payment_intent=${paymentIntent || null}, updated_at=now()
    where stripe_session_id=${sessionId}
    returning *
  `;
  return rows[0] || null;
}

export async function getOrderBySession(sessionId) {
  const sql = db();
  const rows = await sql`select * from litix_supplier_orders where stripe_session_id=${sessionId} limit 1`;
  return rows[0] || null;
}

export async function getOrderByIdEmail(orderId, email) {
  const sql = db();
  const rows = await sql`
    select * from litix_supplier_orders
    where id=${orderId} and lower(customer_email)=lower(${email})
    limit 1
  `;
  return rows[0] || null;
}

export async function getOrdersByEmail(email, limit = 25) {
  const sql = db();
  const rows = await sql`
    select id, service_name, quantity, retail_cents, payment_status, fulfillment_status, provider_status, created_at, updated_at
    from litix_supplier_orders
    where lower(customer_email)=lower(${email})
    order by created_at desc
    limit ${limit}
  `;
  return rows;
}

export async function fulfillPaidOrder(orderId) {
  const sql = db();
  const claimed = await sql`
    update litix_supplier_orders
    set fulfillment_status='submitting', provider_error=null, updated_at=now()
    where id=${orderId}
      and payment_status='paid'
      and provider_order_id is null
      and stripe_session_id not like 'cs_test_%'
      and fulfillment_status in ('pending','review')
    returning *
  `;
  const order = claimed[0];
  if (!order) return { ok: true, skipped: true };

  try {
    const needed = Number(order.provider_cost || 0);
    const bal = await getProviderBalance();
    if (bal.currency === 'NGN' && bal.balance + 1e-9 < needed) {
      throw new Error('Not enough funds');
    }
    const providerOrderId = await submitProviderOrder({
      serviceId: order.service_id,
      target: order.target_link,
      quantity: order.quantity,
    });
    await sql`
      update litix_supplier_orders
      set fulfillment_status='submitted', provider_order_id=${providerOrderId}, provider_status='Pending', provider_error=null, updated_at=now(), last_reconciled_at=now()
      where id=${order.id}
    `;
    console.log('[litix:lifecycle]', JSON.stringify({ stage: 'supplier_order_submitted', orderId: order.id, providerOrderId }));
    await audit('supplier_order_submitted','order',order.id,{providerOrderId});
    return { ok: true, providerOrderId };
  } catch (err) {
    const message = String(err?.message || err || 'Supplier submission failed').slice(0,500);
    await sql`
      update litix_supplier_orders
      set fulfillment_status='review', provider_error=${message}, updated_at=now(), last_reconciled_at=now()
      where id=${order.id}
    `;
    console.error('Fulfillment queued for review', order.id, message);
    console.log('[litix:lifecycle]', JSON.stringify({ stage: 'fulfillment_review_required', orderId: order.id, reason: 'supplier_submission_failed' }));
    await audit('fulfillment_review_required','order',order.id,{reason:message});
    return { ok: false, error: message };
  }
}

export async function reconcileOrders() {
  const sql = db();
  const retry = await sql`
    select id from litix_supplier_orders
    where payment_status='paid' and provider_order_id is null
      and stripe_session_id not like 'cs_test_%'
      and fulfillment_status in ('pending','review')
    order by created_at asc limit 25
  `;
  for (const row of retry) await fulfillPaidOrder(row.id);

  const active = await sql`
    select id, provider_order_id from litix_supplier_orders
    where payment_status='paid' and provider_order_id is not null
      and fulfillment_status in ('submitted','processing')
    order by updated_at asc limit 50
  `;
  for (const row of active) {
    try {
      const st = await getProviderOrderStatus(row.provider_order_id);
      const status = String(st?.status || st?.Status || 'Unknown');
      const mapped = /complete/i.test(status) ? 'completed' : /cancel|fail/i.test(status) ? 'review' : 'processing';
      await sql`
        update litix_supplier_orders set provider_status=${status}, provider_remains=${Number(st?.remains ?? 0) || 0}, fulfillment_status=${mapped}, provider_error=${st?.error ? String(st.error).slice(0,500) : null}, updated_at=now(), last_reconciled_at=now()
        where id=${row.id}
      `;
    } catch (err) {
      console.error('reconcile_status_failed', row.id, err?.message || err);
    }
  }
  return { retried: retry.length, checked: active.length };
}

export function publicOrder(order) {
  if (!order) return null;
  let status = 'Order received';
  let message = 'Your order has been received.';
  const payment = String(order.payment_status || '').toLowerCase();
  const fulfill = String(order.fulfillment_status || '').toLowerCase();
  const provider = String(order.provider_status || '');
  if (payment !== 'paid') {
    status = 'Awaiting payment';
    message = 'Payment has not been confirmed yet.';
  } else if (fulfill === 'completed' || /complete/i.test(provider)) {
    status = 'Completed';
    message = 'Your order has completed.';
  } else if (fulfill === 'submitted' || fulfill === 'processing') {
    status = 'In progress';
    message = provider && provider !== 'Pending' ? `Supplier status: ${provider}.` : 'Your order is with the supplier and is being processed.';
  } else if (fulfill === 'review') {
    status = 'Paid — fulfillment delayed';
    message = 'Your payment is confirmed. Fulfillment is temporarily delayed and Litix will keep retrying automatically.';
  } else {
    status = 'Payment confirmed';
    message = 'Payment is confirmed and your order is being sent for fulfillment.';
  }
  return {
    id: order.id,
    service_name: order.service_name,
    quantity: order.quantity,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    provider_status: order.provider_status,
    status,
    message,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}
