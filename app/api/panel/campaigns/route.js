import crypto from 'crypto';
import {NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {requireAccount,placeWalletOrder} from '../../../../lib/panel';
import {getServiceById,normalizeTarget} from '../../../../lib/provider';
export const dynamic='force-dynamic';
export async function GET(req){try{const u=requireAccount(req),sql=db();const rows=await sql`select * from litix_campaigns where customer_id=${u.sub} order by created_at desc limit 100`;return NextResponse.json({campaigns:rows});}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
export async function POST(req){
  try{
    const u=requireAccount(req),b=await req.json(); const mode=String(b.mode||'drip_feed');
    if(mode==='drip_feed'&&b.native!==false){const r=await placeWalletOrder(u,{...b,runs:b.runs,interval:b.intervalMinutes||b.interval});return NextResponse.json({native:true,...r});}
    const s=await getServiceById(b.serviceId);if(!s)return NextResponse.json({error:'Service unavailable'},{status:400});
    const target=normalizeTarget(s,b.target);const quantity=Math.floor(Number(b.quantity));const runs=Math.floor(Number(b.runs));const interval=Math.floor(Number(b.intervalMinutes));
    if(!Number.isFinite(quantity)||quantity<s.min||quantity>s.max||!Number.isFinite(runs)||runs<1||runs>1000||!Number.isFinite(interval)||interval<60)return NextResponse.json({error:'Scheduled campaigns require a valid quantity, 1-1000 runs, and an interval of at least 60 minutes.'},{status:400});
    const id=`cmp_${crypto.randomUUID()}`,sql=db();
    await sql`insert into litix_campaigns (id,customer_id,email,mode,service_catalog_id,target,quantity_per_run,runs,interval_minutes,status,next_run_at,created_at,updated_at) values (${id},${u.sub},${u.email},${mode},${String(b.serviceId)},${target},${quantity},${runs},${interval},'active',now(),now(),now())`;
    return NextResponse.json({campaignId:id,status:'active',scheduled:true});
  }catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}
}
export async function DELETE(req){try{const u=requireAccount(req),b=await req.json(),sql=db();const r=await sql`update litix_campaigns set status='cancelled',updated_at=now() where id=${b.id} and customer_id=${u.sub} returning id`;return NextResponse.json({ok:Boolean(r[0])});}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
