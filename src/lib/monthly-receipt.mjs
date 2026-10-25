export async function customerReceipt(sql,subject,transactionId){
 if(typeof transactionId!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(transactionId))return null;
 const rows=await sql.query(`select p.transaction_id,p.amount_cents,p.currency,p.period_start,p.period_end,p.verified_at,s.likes_per_post
 from litix_monthly_settlements p join litix_monthly_subscriptions s on s.id=p.subscription_id
 where s.customer_subject=$1 and p.transaction_id=$2`,[subject,transactionId]);
 if(rows.length!==1)return null;
 return {kind:'verified_payment_receipt',sandbox:true,...rows[0]};
}
