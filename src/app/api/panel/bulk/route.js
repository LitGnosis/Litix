import crypto from 'crypto';
import {NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {requireAccount,placeWalletOrder} from '../../../../lib/panel';
export const dynamic='force-dynamic';
export async function POST(req){
  let batchId;
  try{
    const u=requireAccount(req),b=await req.json(); const orders=Array.isArray(b.orders)?b.orders.slice(0,100):[];
    if(!orders.length)return NextResponse.json({error:'Add at least one order.'},{status:400});
    batchId=`batch_${crypto.randomUUID()}`; const sql=db();
    await sql`insert into litix_bulk_batches (id,customer_id,email,status,total_orders,completed_orders,failed_orders,total_cents,created_at,updated_at) values (${batchId},${u.sub},${u.email},'processing',${orders.length},0,0,0,now(),now())`;
    const results=[];let completed=0,failed=0,total=0;
    for(let i=0;i<orders.length;i++){
      try{const r=await placeWalletOrder(u,orders[i]);completed++;total+=Math.round(Number(r.charge)*100);results.push({index:i,ok:true,...r});}
      catch(e){failed++;results.push({index:i,ok:false,error:String(e?.message||e)});}
    }
    const status=failed===0?'completed':completed===0?'failed':'partial';
    await sql`update litix_bulk_batches set status=${status},completed_orders=${completed},failed_orders=${failed},total_cents=${total},updated_at=now() where id=${batchId}`;
    return NextResponse.json({batchId,status,completed,failed,totalCents:total,results});
  }catch(e){console.error('bulk_error',batchId||'',e?.message||e);return NextResponse.json({error:e.message},{status:e.status||500})}
}
