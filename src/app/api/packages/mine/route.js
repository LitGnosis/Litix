import {NextResponse} from 'next/server';
import {requirePackageUser,packagePurchases} from '../../../../lib/specialPackages';
export const dynamic='force-dynamic';
export async function GET(req){try{const u=requirePackageUser(req);return NextResponse.json({purchases:await packagePurchases(u)})}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
