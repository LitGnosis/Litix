import Stripe from 'stripe';
let instance;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured');
  if (!instance) instance = new Stripe(key);
  return instance;
}
export function requireLiveStripe() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (process.env.VERCEL_ENV === 'production' && !key.startsWith('sk_live_')) throw new Error('Live Stripe is required in production');
}
