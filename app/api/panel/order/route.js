import {NextResponse} from 'next/server';
import {requireAccount,placeWalletOrder,refreshOrderStatus} from '../../../../lib/panel';
export const dynamic='force-dynamic';
export async function POST(req){try{const u=requireAccount(req);const b=await req.json();return NextResponse.json(await placeWalletOrder(u,b));}catch(e){return NextResponse.json({error:e.message,code:e.code},{status:e.status||500})}}
export async function GET(req){try{const u=requireAccount(req);const id=new URL(req.url).searchParams.get('id');const o=await refreshOrderStatus(u,id);return o?NextResponse.json({order:o}):NextResponse.json({error:'Order not found'},{status:404});}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
