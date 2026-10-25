import {createHash,randomBytes} from 'node:crypto';
export const digestToken=token=>createHash('sha256').update(token).digest('hex');
export function newManagementToken(){const token=randomBytes(32).toString('base64url');return {token,hash:digestToken(token)}}
export function bearer(headers){const value=headers.get('authorization')||'';return /^Bearer [A-Za-z0-9_-]{43}$/.test(value)?value.slice(7):null}
export function publicSubscription(row){return {id:row.id,likesPerPost:row.likes_per_post,amountCents:row.amount_cents,currency:row.currency,dailyPostLimit:row.daily_post_limit,billingState:row.billing_state,cancellationState:row.cancellation_state,paidThrough:row.paid_through}}
export async function manageSubscription({token,cancel=false,repository,gateway}){
 if(!token)return {status:401,body:{error:'A valid private management link is required.'}};
 const row=await repository.find(digestToken(token));
 if(!row)return {status:404,body:{error:'Management link is invalid or expired.'}};
 if(!cancel)return {status:200,body:{subscription:publicSubscription(row)}};
 if(row.cancellation_state==='confirmed')return {status:200,body:{subscription:publicSubscription(row),message:'Future renewals are stopped.'}};
 // Durable atomic claim before network I/O. Competing requests cannot duplicate dispatch.
 const claimed=await repository.claim(row.id);
 if(!claimed)return {status:202,body:{message:'Cancellation is pending confirmation. Do not submit another request.',cancellationState:'review'}};
 if(!claimed.provider_subscription_id){await repository.finish(row.id,'review','missing_provider_id');return {status:202,body:{message:'Cancellation requires review; gateway confirmation is not available.',cancellationState:'review'}}}
 const result=await gateway(claimed.provider_subscription_id);
 const confirmed=result.state==='renewal_stopped';
 await repository.finish(row.id,confirmed?'confirmed':'review',result.code||result.state);
 return {status:confirmed?200:202,body:{cancellationState:confirmed?'confirmed':'review',paidThrough:row.paid_through,message:confirmed?'Future renewals stopped. Any remaining paid coverage ends at the displayed paid-through date.':'Cancellation requested but not confirmed. Support reconciliation is required.'}};
}
