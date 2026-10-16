import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '../../../../lib/db';
import { findCustomer, hashPassword, makeToken, authCookie } from '../../../../lib/auth';
export const dynamic='force-dynamic';
export async function POST(req) {
  try {
    const { email, password, name } = await req.json();
    const e=String(email||'').trim().toLowerCase(); const p=String(password||''); const n=String(name||'').trim().slice(0,100);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return NextResponse.json({error:'Enter a valid email.'},{status:400});
    if (p.length<8) return NextResponse.json({error:'Password must be at least 8 characters.'},{status:400});
    if (await findCustomer(e)) return NextResponse.json({error:'An account already exists for that email.'},{status:409});
    const id=`cus_${crypto.randomUUID()}`; const passwordHash=await hashPassword(p); const sql=db();
    await sql`insert into litix_customers (id,email,password_hash,name,role,email_verified,marketing_opt_in,password_updated_at,created_at,updated_at) values (${id},${e},${passwordHash},${n||null},'customer',false,false,now(),now(),now())`;
    const token=makeToken({id,email:e,name:n});
    return NextResponse.json({ok:true,user:{id,email:e,name:n}},{headers:{'set-cookie':authCookie(token)}});
  } catch (err) { console.error('register_error',err?.message||err); return NextResponse.json({error:'Unable to create account.'},{status:500}); }
}
