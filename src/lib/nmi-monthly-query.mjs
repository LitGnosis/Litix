import {XMLParser,XMLValidator} from 'fast-xml-parser';
const parser=new XMLParser({parseTagValue:false,ignoreAttributes:true,processEntities:false});
const list=x=>x===undefined?[]:Array.isArray(x)?x:[x];
function cents(value){if(typeof value!=='string'||!/^\d{1,7}\.\d{2}$/.test(value))throw Error('Invalid payment amount');return Number(value.replace('.',''))}
// Returns matched settled transaction only. Coverage dates must come from a
// persisted billing schedule, not guessed from API creation or response time.
export function verifyMonthlyTransaction(xml,{transactionId,subscription}){
 if(typeof xml!=='string'||xml.length>262144||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Invalid gateway XML');
 const envelope=parser.parse(xml)?.nm_response;
 if(!envelope||Object.keys(envelope).some(key=>key!=='transaction'))throw Error('Unexpected gateway envelope');
 const rows=list(envelope.transaction);
 if(rows.length!==1)throw Error('Expected one unambiguous transaction');
 const row=rows[0];
 if(row.transaction_id!==transactionId||row.order_id!==subscription.id||row.email?.toLowerCase()!==subscription.email.toLowerCase()||row.currency!=='USD'||row.condition!=='complete')throw Error('Transaction identity or settlement mismatch');
 const actions=list(row.action);
 // Conservative: refunds, voids, multiple or partial actions need reconciliation.
 if(actions.length!==1)throw Error('Complex transaction requires reconciliation');
 const action=actions[0];
 if(action.action_type!=='sale'||action.source!=='recurring'||action.success!=='1'||action.response_code!=='100'||cents(action.amount)!==subscription.amount_cents)throw Error('Recurring sale not verified');
 return {transactionId:row.transaction_id,subscriptionId:subscription.provider_subscription_id,amountCents:subscription.amount_cents,currency:'USD',approved:true};
}
export async function queryMonthlyTransaction({transactionId,subscription,securityKey,fetchImpl=fetch}){
 if(!/^[1-9][0-9]{0,19}$/.test(transactionId)||! /^[1-9][0-9]{0,19}$/.test(subscription?.provider_subscription_id||'')||!securityKey)throw Error('Invalid payment query configuration');
 const response=await fetchImpl('https://paykings.transactiongateway.com/api/query.php',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({security_key:securityKey,transaction_id:transactionId,subscription_id:subscription.provider_subscription_id,source:'recurring'}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Gateway query unavailable');
 return verifyMonthlyTransaction(await response.text(),{transactionId,subscription});
}
