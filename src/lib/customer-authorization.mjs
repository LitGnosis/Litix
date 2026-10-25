export function verifiedCustomer(session){
 const u=session?.user;
 if(!u||typeof u.sub!=='string'||!u.sub||u.sub.length>255)return null;
 if(u.email_verified!==true||typeof u.email!=='string')return null;
 return {subject:u.sub,email:u.email.toLowerCase()};
}
export async function customerRecords(sql,subject){
 // Never bind historic orders to an account merely because its email matches.
 const params=[subject];
 const [subscriptions,payments,orders,fulfillment]=await Promise.all([
 sql.query('select id,likes_per_post,amount_cents,currency,billing_state,cancellation_state,paid_through from litix_monthly_subscriptions where customer_subject=$1 order by created_at desc limit 100',params),
 sql.query('select p.transaction_id,p.amount_cents,p.currency,p.period_start,p.period_end,p.verified_at from litix_monthly_settlements p join litix_monthly_subscriptions s on s.id=p.subscription_id where s.customer_subject=$1 order by p.verified_at desc limit 100',params),
 sql.query('select order_id,created_at from litix_customer_order_links where customer_subject=$1 order by created_at desc limit 100',params),
 sql.query('select p.post_id,p.utc_day,p.state,p.supplier_order_id from litix_monthly_post_claims p join litix_monthly_subscriptions s on s.id=p.subscription_id where s.customer_subject=$1 order by p.utc_day desc limit 100',params)
 ]);return {subscriptions,payments,orders,fulfillment};
}
