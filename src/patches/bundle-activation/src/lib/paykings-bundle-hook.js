import crypto from 'node:crypto';
export function validSignature(headers, rawBody, secret) {
  if (!secret) return false;
  const signature = typeof headers.get === 'function' ? headers.get('x-paykings-signature') : headers['x-paykings-signature'];
  if (!/^[a-fA-F0-9]{64}$/.test(signature || '')) return false;
  const expected = crypto.createHmac('sha256',secret).update(rawBody).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export async function handlePaykingsWebhook(headers, rawBody, {repository, fulfill, secret=process.env.PAYKINGS_WEBHOOK_SECRET}={}) {
  if (!secret) return {status:503,body:{error:'Webhook not configured'}};
  if (!validSignature(headers,rawBody,secret)) return {status:401,body:{error:'Invalid signature'}};
  let payload;
  try {payload=JSON.parse(rawBody);} catch {return {status:400,body:{error:'Invalid payload'}};}
  // "approved" is not proof of captured/settled funds.
  if (payload.status !== 'captured') return {status:200,body:{status:'ignored'}};
  if (!repository || !fulfill) return {status:503,body:{error:'Bundle integration not configured'}};
  const id=payload.custom_fields?.order_id;
  const rawAmount=String(payload.amount ?? '');
  if (typeof id!=='string' || !/^ltx_[a-zA-Z0-9_-]+$/.test(id) || !/^\d+\.\d{2}$/.test(rawAmount) || payload.currency!=='USD' || typeof payload.transaction_id!=='string' || !payload.transaction_id.trim()) return {status:400,body:{error:'Invalid settlement fields'}};
  const cents=Math.round(Number(rawAmount)*100);
  if (!Number.isSafeInteger(cents) || cents<=0) return {status:400,body:{error:'Invalid amount'}};
  const verified=await repository.verifyPayment(id,{cents,reference:payload.transaction_id});
  if (!verified) return {status:409,body:{error:'Settlement does not match order'}};
  const result=await fulfill(id);
  return {status:200,body:{status:result.reconciliationRequired?'awaiting_reconciliation':result.status||'received'}};
}
