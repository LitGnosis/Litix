import { NextResponse } from 'next/server';
import { reconcileOrders } from '../../../../lib/orders';
export const dynamic = 'force-dynamic';
function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}` || new URL(req.url).searchParams.get('secret') === secret || req.headers.get('x-vercel-cron') === '1';
}
export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  try { return NextResponse.json({ ok:true, ...(await reconcileOrders()) }); }
  catch (err) { console.error('reconcile_error', err?.message || err); return NextResponse.json({ ok:false }, { status:500 }); }
}
