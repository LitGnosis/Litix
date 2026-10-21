import {NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {placeWalletOrder} from '../../../../lib/panel';
export const dynamic='force-dynamic';
function authorized(req){const s=process.env.CRON_SECRET;if(!s)return false;return req.headers.get('authorization')===`Bearer ${s}`||req.headers.get('x-cron-secret')===s}
export async function GET(req){
  if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
  const sql=db();const rows=await sql`select * from litix_campaigns where status='active' and next_run_at<=now() order by next_run_at asc limit 25`;const results=[];
  for(const c of rows){
    const users=await sql`select id,email,name from litix_customers where id=${c.customer_id} limit 1`;const x=users[0];if(!x)continue;const u={sub:x.id,email:x.email,name:x.name||''};
    try{const r=await placeWalletOrder(u,{serviceId:c.service_catalog_id,target:c.target,quantity:c.quantity_per_run});const remaining=Math.max(0,Number(c.runs)-1);const next=new Date(Date.now()+Number(c.interval_minutes)*60000).toISOString();await sql`update litix_campaigns set runs=${remaining},last_run_at=now(),next_run_at=${remaining?next:null},status=${remaining?'active':'completed'},updated_at=now() where id=${c.id}`;results.push({id:c.id,ok:true,order:r.order,remaining});}
    catch(e){const pause=e?.code==='INSUFFICIENT_FUNDS';await sql`update litix_campaigns set status=${pause?'paused':'active'},next_run_at=${new Date(Date.now()+Math.max(60,Number(c.interval_minutes))*60000).toISOString()},updated_at=now() where id=${c.id}`;results.push({id:c.id,ok:false,error:String(e?.message||e)});}
  }
  return NextResponse.json({processed:results.length,results});
}
