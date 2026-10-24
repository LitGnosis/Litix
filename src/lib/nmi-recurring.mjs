// Internal adapter only. Not a public endpoint or an activation switch.
// Caller must authenticate ownership, persist intent/attempt, and reconcile outcomes.
const endpoint='https://paykings.transactiongateway.com/api/transact.php';
export async function cancelRecurring({subscriptionId,securityKey,fetchImpl=fetch}){
 if(!/^[1-9][0-9]{0,19}$/.test(String(subscriptionId))||!securityKey)throw Error('Invalid recurring cancellation configuration');
 try{
  const response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({security_key:securityKey,recurring:'delete_subscription',subscription_id:String(subscriptionId)}),signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});
  if(!response.ok)return {state:'review',code:'gateway_http_error'};
  const raw=await response.text();
  if(raw.length>16000)return {state:'review',code:'invalid_gateway_response'};
  const values=new URLSearchParams(raw);
  if(values.getAll('response').length!==1)return {state:'review',code:'invalid_gateway_response'};
  if(values.get('response')==='1')return {state:'renewal_stopped'};
  if(['2','3'].includes(values.get('response')))return {state:'not_confirmed',code:'gateway_rejected'};
  return {state:'review',code:'invalid_gateway_response'};
 }catch{return {state:'review',code:'unknown_gateway_outcome'}}
}
