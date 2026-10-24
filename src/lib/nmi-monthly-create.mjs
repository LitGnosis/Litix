// Internal adapter; requires separately approved first-charge date.
// Creation is not evidence of payment. Never auto-retry an ambiguous outcome.
export async function createNmiMonthly({id,quote,email,paymentToken,startDate,securityKey,fetchImpl=fetch}){
 if(!securityKey||typeof paymentToken!=='string'||paymentToken.length<10||!Number.isSafeInteger(quote?.amountCents)||quote.amountCents<1||quote.currency!=='USD'||!/^\d{4}-\d{2}-(0[1-9]|1\d|2[0-8])$/.test(startDate||''))throw Error('Approved monthly configuration and first-charge date (day 1–28) required');
 const date=new Date(startDate+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==startDate)throw Error('Invalid first-charge date');
 try{
  const response=await fetchImpl('https://paykings.transactiongateway.com/api/transact.php',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({security_key:securityKey,recurring:'add_subscription',plan_payments:'0',plan_amount:(quote.amountCents/100).toFixed(2),month_frequency:'1',day_of_month:String(date.getUTCDate()),start_date:startDate.replaceAll('-',''),payment_token:paymentToken,currency:'USD',orderid:id,email,customer_receipt:'true'})});
  if(!response.ok)return {state:'review'};
  const text=await response.text();if(text.length>16000)return {state:'review'};
  const result=new URLSearchParams(text);
  if(result.getAll('response').length!==1||result.getAll('subscription_id').length!==1)return {state:'review'};
  if(result.get('response')==='1'&&/^[1-9][0-9]{0,19}$/.test(result.get('subscription_id')))return {state:'created',subscriptionId:result.get('subscription_id')};
  return {state:'review'};
 }catch{return {state:'review'}}
}
