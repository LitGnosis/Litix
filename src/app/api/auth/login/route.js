import { NextResponse } from 'next/server';
import { findCustomer, verifyPassword, makeToken, authCookie } from '../../../../lib/auth';
export const dynamic='force-dynamic';
export async function POST(req) {
  try {
    const {email,password}=await req.json(); const e=String(email||'').trim().toLowerCase();
    const user=await findCustomer(e);
    if (!user || !await verifyPassword(String(password||''),user.password_hash)) return NextResponse.json({error:'Email or password is incorrect.'},{status:401});
    const token=makeToken({id:user.id,email:user.email,name:user.name||''});
    return NextResponse.json({ok:true,user:{id:user.id,email:user.email,name:user.name||''}},{headers:{'set-cookie':authCookie(token)}});
  } catch (err) { console.error('login_error',err?.message||err); return NextResponse.json({error:'Unable to sign in.'},{status:500}); }
}
