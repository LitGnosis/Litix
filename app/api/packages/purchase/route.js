import {NextResponse} from 'next/server';
import {requirePackageUser,purchasePackageWithWallet} from '../../../../lib/specialPackages';
export const dynamic='force-dynamic';
export async function POST(req){try{const u=requirePackageUser(req),b=await req.json();return NextResponse.json(await purchasePackageWithWallet(u,b.packageId))}catch(e){console.error('package_purchase_error',e?.message||e);return NextResponse.json({error:e.message,code:e.code||null},{status:e.status||500})}}
