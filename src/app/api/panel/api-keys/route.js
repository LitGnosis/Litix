import {NextResponse} from 'next/server';
import {requireAccount,createApiKey,listApiKeys,revokeApiKey} from '../../../../lib/panel';
export const dynamic='force-dynamic';
export async function GET(req){try{const u=requireAccount(req);return NextResponse.json({keys:await listApiKeys(u)});}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
export async function POST(req){try{const u=requireAccount(req);const b=await req.json().catch(()=>({}));return NextResponse.json(await createApiKey(u,b.label));}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
export async function DELETE(req){try{const u=requireAccount(req);const b=await req.json();return NextResponse.json({ok:await revokeApiKey(u,b.id)});}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
