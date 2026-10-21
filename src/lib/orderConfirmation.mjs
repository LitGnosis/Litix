export const checkoutReferenceKey = 'litix.checkout.reference';
export function confirmationState(order) {
  if (order?.paymentStatus === 'paid') return order.fulfillmentStatus === 'completed' ? 'completed' : 'confirmed';
  if (order?.paymentStatus === 'failed') return 'failed';
  return 'pending';
}
export function savedCheckoutReference(raw, now = Date.now()) {
  try {
    const value = JSON.parse(raw);
    if (typeof value.order_id !== 'string' || !value.order_id.startsWith('ltx_') || typeof value.email !== 'string' || !value.email.includes('@') || !Number.isFinite(value.createdAt) || now < value.createdAt || now - value.createdAt > 86400000) return null;
    return {order_id:value.order_id,email:value.email};
  } catch { return null; }
}
