import {NextResponse} from 'next/server';import {requireAccount,requestRefill,refillStatus} from '../../../../lib/panel';
export const dynamic='force-dynamic';
export async function POST(req){try{const u=requireAccount(req),b=await req.json();return NextResponse.json(await requestRefill(u,b.orderId));}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
export async function GET(req){try{const u=requireAccount(req),id=new URL(req.url).searchParams.get('id');const r=await refillStatus(u,id);return r?NextResponse.json({refill:r}):NextResponse.json({error:'Refill not found'},{status:404});}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
