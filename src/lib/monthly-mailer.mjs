export async function sendManagementEmail({id,email,token,apiKey,from,baseUrl='https://litix.net',fetchImpl=fetch}){
 if(!apiKey||!from||! /^[A-Za-z0-9_-]{43}$/.test(token))throw Error('Management email configuration invalid');
 const base=new URL(baseUrl);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Invalid management origin');
 const link=base.origin+'/subscriptions/manage#token='+token;
 const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'monthly-management/'+id},body:JSON.stringify({from,to:[email],subject:'Manage your Litix monthly subscription',text:'Keep this private link secure. Anyone with it can view or cancel your subscription.\n\n'+link+'\n\nCanceling stops future renewals; verified paid coverage continues until its end date.'}),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Management email delivery not confirmed');
 const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('Management email acknowledgement missing');
 return {messageId:result.id};
}
