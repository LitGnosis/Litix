// Internal application service. Not exposed as a public route.
// Repository methods reserve/claimCreation/recordSettlementAndExtend must be atomic.
import {randomUUID} from 'node:crypto';
import {newManagementToken} from './subscription-management.mjs';
const prices=new Map([[100,560],[150,800],[250,1200],[1000,3200],[2000,5600]]);
export function quoteMonthly(likes,{test=false}={}){
 const amountCents=test&&likes===100?50:prices.get(likes);
 if(!amountCents)throw Error('Unsupported monthly tier');
 return {likes,amountCents,currency:'USD',dailyLimit:3,interval:'calendar_month',consentVersion:'monthly-v1'};
}
export async function createMonthly({input,repository,gateway,mailer,now=new Date(),test=false}){
 if(!input||input.consent!==true||input.consentVersion!=='monthly-v1')throw Error('Explicit current recurring consent required');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email||'')||! /^[a-f0-9-]{36}$/.test(input.idempotencyKey||'')||typeof input.paymentToken!=='string'||input.paymentToken.length<10)throw Error('Invalid checkout input');
 const quote=quoteMonthly(input.likes,{test});
 if(input.expectedAmountCents!==quote.amountCents)throw Error('Confirm the current monthly price');
 const capability=newManagementToken(),id=randomUUID();
 // No raw token or payment token is stored in the reservation.
 const reservation=await repository.reserve({id,email:input.email.toLowerCase(),idempotencyKey:input.idempotencyKey,quote,managementTokenHash:capability.hash,managementTokenExpiresAt:new Date(now.getTime()+366*86400000).toISOString(),consentAt:now.toISOString(),customerSubject:input.customerSubject||null});
 if(!reservation.created)return {state:'already_requested',canRetry:false};
 const claimed=await repository.claimCreation(id);
 if(!claimed)return {state:'review',canRetry:false};
 let result;try{result=await gateway.create({id,quote,email:input.email,paymentToken:input.paymentToken})}catch{result={state:'review'}}
 if(result.state!=='created'||! /^[1-9][0-9]{0,19}$/.test(String(result.subscriptionId||''))){await repository.creationReview(id);return {state:'review',canRetry:false}}
 await repository.created(id,String(result.subscriptionId));
 // Created does NOT mean paid. Never dispatch from this acknowledgement.
 try{await mailer.sendManagement({id,email:input.email,token:capability.token});await repository.linkDelivered(id)}catch{await repository.deliveryReview(id);return {state:'created_link_delivery_review',canRetry:false}}
 return {state:'created_awaiting_verified_payment',canRetry:false};
}
// Call only from an authenticated server-to-server transaction-query adapter,
// never from a browser payment flag or an unverified webhook body.
export async function applyVerifiedSettlement({subscriptionId,queryGateway,repository,now=new Date()}){
 const subscription=await repository.findById(subscriptionId);
 if(!subscription?.provider_subscription_id)throw Error('Subscription unavailable');
 const evidence=await queryGateway(subscription);
 const start=Date.parse(evidence?.periodStart),end=Date.parse(evidence?.periodEnd);
 if(evidence?.approved!==true||evidence.subscriptionId!==subscription.provider_subscription_id||evidence.amountCents!==subscription.amount_cents||evidence.currency!=='USD'||! /^[a-zA-Z0-9_-]{1,100}$/.test(evidence.transactionId||'')||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start>now.getTime())throw Error('Settlement does not match subscription');
 return repository.recordSettlementAndExtend({subscription,evidence,verifiedAt:now.toISOString()});
}
