import crypto from 'crypto';
import { db } from './db';

const COOKIE = 'litix_session';
function secret() {
  const s = process.env.LITIX_AUTH_SECRET || process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!s) throw new Error('Auth secret is not configured');
  return s;
}
function b64(input) { return Buffer.from(input).toString('base64url'); }
function sign(data) { return crypto.createHmac('sha256', secret()).update(data).digest('base64url'); }

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await new Promise((resolve,reject)=>crypto.scrypt(password, salt, 64, (e,k)=>e?reject(e):resolve(k)));
  return `scrypt$${salt}$${Buffer.from(hash).toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [alg,salt,hex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const hash = await new Promise((resolve,reject)=>crypto.scrypt(password, salt, 64, (e,k)=>e?reject(e):resolve(k)));
  const a = Buffer.from(hex,'hex'), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
export function makeToken(user) {
  const payload = b64(JSON.stringify({ sub:user.id, email:user.email, name:user.name || '', exp: Date.now()+30*24*60*60*1000 }));
  return `${payload}.${sign(payload)}`;
}
export function parseToken(token) {
  try {
    const [payload,sig] = String(token || '').split('.');
    const expected = sign(payload);
    const a = Buffer.from(sig || ''), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return null;
    const data = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if (!data?.sub || !data?.email || Number(data.exp) < Date.now()) return null;
    return data;
  } catch { return null; }
}
export function authCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*24*60*60}`;
}
export function clearAuthCookie() { return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export function cookieToken(req) {
  const raw = req.headers.get('cookie') || '';
  const entry = raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(COOKIE.length+1)) : '';
}
export function currentUser(req) { return parseToken(cookieToken(req)); }

export async function findCustomer(email) {
  const sql = db();
  const rows = await sql`select * from litix_customers where lower(email)=lower(${email}) limit 1`;
  return rows[0] || null;
}
