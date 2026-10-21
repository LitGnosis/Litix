import {NextResponse} from 'next/server';
import {requirePackageUser,redeemPackage} from '../../../../lib/specialPackages';
export const dynamic='force-dynamic';
export async function POST(req){try{const u=requirePackageUser(req),b=await req.json();return NextResponse.json(await redeemPackage(u,b))}catch(e){console.error('package_redeem_error',e?.message||e);return NextResponse.json({error:e.message},{status:e.status||500})}}
