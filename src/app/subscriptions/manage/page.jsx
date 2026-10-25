'use client';
import {useEffect,useRef,useState} from 'react';
export default function Manage(){
 const token=useRef('');const [subscription,setSubscription]=useState(null),[message,setMessage]=useState('Loading private management details…'),[busy,setBusy]=useState(false);
 async function request(cancel=false){setBusy(true);try{
 const r=await fetch('/api/subscriptions/v1/manage',{method:cancel?'POST':'GET',headers:{Authorization:'Bearer '+token.current},cache:'no-store',signal:AbortSignal.timeout(20000)});const v=await r.json();if(!r.ok)throw Error(v.error||'Unable to confirm management outcome.');if(v.subscription)setSubscription(v.subscription);if(v.cancellationState)setSubscription(old=>old?{...old,cancellationState:v.cancellationState}:old);setMessage(v.message||'Keep this link private. It authorizes access to this subscription.');
 }catch(e){setMessage(e.message)}finally{setBusy(false)}}
 useEffect(()=>{token.current=new URLSearchParams(location.hash.slice(1)).get('token')||'';history.replaceState(null,'',location.pathname);if(token.current)request();else setMessage('Open your private subscription management link. No subscription was changed.')},[]);
 return <main className="wrap"><section className="panel"><h1>Manage subscription</h1><p role="status">{message}</p>{subscription&&<><p>{subscription.likesPerPost} likes per post · Up to {subscription.dailyPostLimit} posts per UTC day</p><p>{new Intl.NumberFormat('en-US',{style:'currency',currency:subscription.currency}).format(subscription.amountCents/100)}/month</p><p>Paid through: {subscription.paidThrough||'No verified paid coverage'}</p><p>Cancellation: {subscription.cancellationState}</p><button className="alt" disabled={busy||subscription.cancellationState!=='none'} onClick={()=>request(true)}>Cancel future renewals</button></>}<p>No new subscription can be purchased on this page.</p></section></main>
}
