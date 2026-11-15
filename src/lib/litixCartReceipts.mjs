import {boosteroSQL,boosteroNotice} from "./boosteroFulfillment.mjs";
import {litixCartTrackingToken} from "./litixCartTrackingToken.mjs";
export async function sendPendingCartReceipts({sql=boosteroSQL(),orderId=null,limit=5}={}){
 const results={claimed:0,sent:0,failed:0};
 for(let i=0;i<Math.max(1,Math.min(limit,10));i++){
  const rows=await sql.query(
   `with chosen as (
     select r.order_id from public.litix_cart_receipts r
      join public.litix_v2_orders o on o.id=r.order_id
     where o.payment_state='paid'
      and ($1::text is null or r.order_id=$1)
      and ((r.state='queued' and r.next_attempt_at<=now())
       or (r.state='sending' and r.leased_at<now()-interval '12 minutes'))
      and r.attempts<6
     order by r.next_attempt_at limit 1 for update of r skip locked
    )
    update public.litix_cart_receipts r
     set state='sending',attempts=attempts+1,leased_at=now()
     where r.order_id in(select order_id from chosen)
     returning r.order_id,r.attempts`,
   [orderId]);
  if(rows.length!==1)break;
  const r=rows[0];
  results.claimed++;
  try{
   const signed=litixCartTrackingToken(r.order_id);
   const ok=await boosteroNotice(r.order_id,signed);
   if(!ok)throw Error("receipt_not_sent");
   await sql.query(
    "update public.litix_cart_receipts set state='sent',sent_at=now(),leased_at=null,last_error=null where order_id=$1 and state='sending'",
    [r.order_id]);
   results.sent++;
  }catch(e){
   results.failed++;
   await sql.query(
    "update public.litix_cart_receipts set state=$2,leased_at=null,last_error=$3,next_attempt_at=now()+interval '15 minutes' where order_id=$1 and state='sending'",
    [r.order_id,Number(r.attempts)>=6?"failed":"queued",String(e?.message||"receipt_send_unavailable").slice(0,100)]
   ).catch(()=>{});
  }
 }
 return results;
}
