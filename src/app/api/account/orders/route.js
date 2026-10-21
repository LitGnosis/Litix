import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { getOrdersByEmail, publicOrder } from '../../../../lib/orders';
export const dynamic='force-dynamic';
export async function GET(req){
  const u=currentUser(req); if(!u) return NextResponse.json({error:'Sign in required.'},{status:401});
  try { const rows=await getOrdersByEmail(u.email); return NextResponse.json({orders:rows.map(publicOrder)}); }
  catch(err){console.error('account_orders_error',err?.message||err);return NextResponse.json({error:'Unable to load orders.'},{status:500});}
}
