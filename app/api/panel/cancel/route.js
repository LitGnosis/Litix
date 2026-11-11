import {NextResponse} from 'next/server';import {requireAccount,requestCancel} from '../../../../lib/panel';
export const dynamic='force-dynamic';
export async function POST(req){try{const u=requireAccount(req),b=await req.json();return NextResponse.json(await requestCancel(u,b.orderId));}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
