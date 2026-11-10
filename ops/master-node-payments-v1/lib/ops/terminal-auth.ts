import { createHmac, timingSafeEqual } from 'node:crypto';

export type OwnerClaims = { aud:'litix-operations'; role:'owner'; sub:string; exp:number };
const cookieName='litix_ops_session';

export function signOwnerSessionForTrustedAuth(claims:OwnerClaims,secret:string):string {
  if(!secret || secret.length<32 || claims.role!=='owner' || claims.aud!=='litix-operations' ||
     !claims.sub || claims.exp<=Math.floor(Date.now()/1000) || claims.exp>Math.floor(Date.now()/1000)+3600) {
    throw new Error('Invalid trusted owner login context');
  }
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const digest=createHmac('sha256',secret).update(payload).digest('base64url');
  return `${payload}.${digest}`;
}

export function isVerifiedOwnerRequest(request:Request):boolean {
  const secret=process.env.LITIX_OPS_SESSION_SECRET;
  if(!secret || secret.length<32) return false;
  const cookie=request.headers.get('cookie') || '';
  const raw=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));
  if(!raw || raw.length>4096)return false;
  const token=raw.slice(cookieName.length+1);
  const pieces=token.split('.');
  if(pieces.length!==2 || pieces[0].length>2000 || !/^[A-Za-z0-9_-]+$/.test(pieces[0]) ||
     !/^[A-Za-z0-9_-]+$/.test(pieces[1]))return false;
  const expected=createHmac('sha256',secret).update(pieces[0]).digest();
  const actual=Buffer.from(pieces[1],'base64url');
  if(actual.length!==expected.length || !timingSafeEqual(expected,actual))return false;
  try {
    const c=JSON.parse(Buffer.from(pieces[0],'base64url').toString('utf8')) as OwnerClaims;
    const now=Math.floor(Date.now()/1000);
    return c.aud==='litix-operations' && c.role==='owner' &&
      typeof c.sub==='string' && c.sub.length>0 && c.sub.length<160 &&
      Number.isSafeInteger(c.exp) && c.exp>now && c.exp<=now+3600;
  } catch{return false;}
}
