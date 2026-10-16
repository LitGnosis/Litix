import {NextResponse} from 'next/server';import {syncCatalog} from '../../../../lib/panel';
export const dynamic='force-dynamic';
function authorized(req){const s=process.env.CRON_SECRET;return Boolean(s)&&(req.headers.get('authorization')===`Bearer ${s}`||req.headers.get('x-cron-secret')===s||req.headers.get('x-vercel-cron')==='1')}
export async function GET(req){if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});try{const s=await syncCatalog();return NextResponse.json({ok:true,services:s.length});}catch(e){return NextResponse.json({error:e.message},{status:500})}}
