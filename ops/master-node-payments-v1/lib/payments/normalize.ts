export type MoneyEvent = {
  provider: 'nmi' | 'stripe';
  eventId: string;
  eventType: string;
  orderId: string | null;
  transactionId: string | null;
  amountCents: number | null;
  currency: string | null;
  liveMode: boolean;
  merchantId: string | null;
  action: 'captured' | 'pending_settlement' | 'settlement_batch' | 'review';
  batchTransactions: string[];
};

const identifier = (x: unknown) => typeof x === 'string' && /^[a-zA-Z0-9_:-]{1,160}$/.test(x) ? x : null;
const asObj = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
const text = (x: unknown) => typeof x === 'string' ? x : '';

export function centsFromDecimal(raw: unknown): number | null {
  const str = typeof raw === 'number' ? String(raw) : raw;
  if (typeof str !== 'string' || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(str)) return null;
  const [d, c = ''] = str.split('.');
  const amount = Number(d) * 100 + Number(c.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}

export function normalizeNmiEvent(value: unknown): MoneyEvent | null {
  const top = asObj(value);
  const eventId = identifier(top.event_id);
  const eventType = text(top.event_type);
  const body = asObj(top.event_body);
  const merchant = asObj(body.merchant);
  const features = asObj(body.features);
  const actionBody = asObj(body.action);
  if (!eventId || !/^((transaction\.(sale|capture|auth|refund|void)\.(success|failure|unknown))|(settlement\.batch\.(complete|failure)))$/.test(eventType)) return null;
  const action: MoneyEvent['action'] = eventType === 'settlement.batch.complete' ? 'settlement_batch' :
    ['transaction.sale.success','transaction.capture.success'].includes(eventType) && text(actionBody.success) === '1' &&
      text(body.transaction_type) === 'cc' ? 'pending_settlement' : 'review';
  return {
    provider:'nmi', eventId, eventType,
    orderId: identifier(body.order_id),
    transactionId: identifier(body.transaction_id),
    amountCents: centsFromDecimal(actionBody.amount ?? body.requested_amount ?? body.amount),
    currency:text(body.currency || 'USD').toUpperCase(),
    liveMode: eventType === 'settlement.batch.complete' ? true : features.is_test_mode === false,
    merchantId:identifier(merchant.id),
    action,
    batchTransactions: Array.isArray(body.transaction_ids)
      ? body.transaction_ids.map(identifier).filter((x): x is string => Boolean(x)).slice(0, 500) : [],
  };
}

export function normalizeStripeEvent(value: unknown): MoneyEvent | null {
  const top = asObj(value);
  const eventId = identifier(top.id);
  const eventType = text(top.type);
  if (!eventId || !/^(payment_intent\.(succeeded|payment_failed|canceled)|charge\.(refunded|dispute\.created))$/.test(eventType)) return null;
  const object = asObj(asObj(top.data).object);
  const metadata = asObj(object.metadata);
  const amount = object.amount_received;
  const validAmount = typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0 && amount <= 1e11 ? amount : null;
  const status = text(object.status);
  return {
    provider:'stripe', eventId, eventType,
    orderId:identifier(metadata.litixOrderId),
    transactionId:identifier(object.id),
    amountCents: validAmount,
    currency:text(object.currency).toUpperCase(),
    liveMode:top.livemode === true,
    merchantId:null,
    action:eventType === 'payment_intent.succeeded' && status === 'succeeded' && validAmount !== null ? 'captured' : 'review',
    batchTransactions: [],
  };
}
