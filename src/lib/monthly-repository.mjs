// Dependency injected Neon query client; no connection or migrations on import.
export function monthlyRepository(sql){return {
 reserve:async x=>({created:(await sql.query(`insert into litix_monthly_subscriptions
 (id,email,idempotency_key,likes_per_post,amount_cents,currency,consent_version,consent_at,management_token_hash,management_token_expires_at)
 values($1,$2,$3,$4,$5,'USD',$6,$7,$8,$9) on conflict(idempotency_key) do nothing returning id`,[x.id,x.email,x.idempotencyKey,x.quote.likes,x.quote.amountCents,x.quote.consentVersion,x.consentAt,x.managementTokenHash,x.managementTokenExpiresAt])).length===1}),
 claimCreation:async id=>(await sql.query("update litix_monthly_subscriptions set creation_state='dispatching',updated_at=now() where id=$1 and creation_state='reserved' returning id",[id])).length===1,
 creationReview:async id=>sql.query("update litix_monthly_subscriptions set creation_state='review',billing_state='review',updated_at=now() where id=$1 and creation_state='dispatching'",[id]),
 created:async(id,providerId)=>{const rows=await sql.query("update litix_monthly_subscriptions set creation_state='created',provider_subscription_id=$2,updated_at=now() where id=$1 and creation_state='dispatching' returning id",[id,providerId]);if(rows.length!==1)throw Error('Creation recording requires reconciliation')},
 linkDelivered:async id=>sql.query("update litix_monthly_subscriptions set link_delivery_state='delivered',updated_at=now() where id=$1",[id]),
 deliveryReview:async id=>sql.query("update litix_monthly_subscriptions set link_delivery_state='review',updated_at=now() where id=$1",[id]),
 findById:async id=>(await sql.query('select * from litix_monthly_subscriptions where id=$1',[id]))[0],
 recordSettlementAndExtend:async({subscription,evidence})=>(await sql.query('select litix_monthly_apply_settlement($1,$2,$3,$4,$5,$6) as applied',[subscription.id,evidence.transactionId,evidence.amountCents,evidence.currency,evidence.periodStart,evidence.periodEnd]))[0]?.applied===true
}}
