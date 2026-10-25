'use client';
import {useEffect,useRef,useState} from 'react';
import PremiumInlineCheckout from './PremiumInlineCheckout';
const tiers=[[100,560],[150,800],[250,1200],[1000,3200],[2000,5600]];
export default function MonthlyCheckout({config}){
 const [likes,setLikes]=useState(100),[consent,setConsent]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('Loading sandbox hosted fields…'),[locked,setLocked]=useState(false);
 const submitToken=useRef(null),attempt=useRef(null),pending=useRef(false);
 const cents=tiers.find(t=>t[0]===likes)[1];
 submitToken.current=async token=>{
  if(!pending.current)return;pending.current=false;setLocked(true);
  try{const response=await fetch('/api/account/subscriptions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...attempt.current,paymentToken:token}),signal:AbortSignal.timeout(30000)});const result=await response.json();
   if(!response.ok)throw Error(result.error||'Subscription outcome unknown. Contact support before retrying.');
   setMessage(result.state==='created_awaiting_verified_payment'?'Sandbox subscription created. Payment has not been verified; no paid coverage is active. Check your account for settlement.':result.state==='created_link_delivery_review'?'Subscription created; email delivery needs support review. Do not submit again.':'Request needs reconciliation. Do not submit again; contact support.');
  }catch(e){setMessage(e.message+' Do not resubmit; contact support for reconciliation.')}finally{setBusy(false)}
 };
 useEffect(()=>{
  let active=true;const script=document.createElement('script');script.src='https://secure.nmi.com/token/Collect.js';script.setAttribute('data-tokenization-key',config.publicKey);
  const timer=setTimeout(()=>{if(active){setReady(false);setMessage('Hosted fields timed out. Reload before submitting.')}},15000);
  script.onload=()=>{if(!active)return;try{window.CollectJS.configure({variant:'inline',fields:{ccnumber:{selector:'#ccnumber',title:'Card number'},ccexp:{selector:'#ccexp',title:'Expiration'},cvv:{selector:'#cvv',title:'Security code'}},fieldsAvailableCallback:()=>{if(active){clearTimeout(timer);setReady(true);setMessage('Sandbox only. Use processor test cards, never a real card.')}},callback:r=>{if(!active)return;if(r?.token)submitToken.current(r.token);else{pending.current=false;setBusy(false);setMessage('Tokenization failed. No subscription request sent.')}}})}catch{setMessage('Hosted fields unavailable. No payment submitted.')}};
  script.onerror=()=>{if(active)setMessage('Hosted fields failed to load. No payment submitted.')};document.head.appendChild(script);
  return()=>{active=false;clearTimeout(timer);script.remove()};
 },[config.publicKey]);
 function submit(e){e.preventDefault();if(!ready||!consent||busy||locked)return;attempt.current={likes,expectedAmountCents:cents,consent:true,consentVersion:'monthly-v1',idempotencyKey:crypto.randomUUID()};pending.current=true;setBusy(true);try{window.CollectJS.startPaymentRequest();setTimeout(()=>{if(pending.current){pending.current=false;setBusy(false);setMessage('Tokenization timed out. No subscription request sent. Reload to retry.');setReady(false)}},20000)}catch{pending.current=false;setBusy(false);setMessage('Tokenization unavailable. No subscription request sent.')}}
 return <main className="wrap"><section className="panel"><a href="/account">Back to account</a><h1>Monthly subscription · sandbox</h1><p>No live charges or supplier dispatch. Up to 3 eligible posts per UTC day after verified settlement. Supplier automation is disabled.</p><form onSubmit={submit}>
 <label>Likes per post <select value={likes} disabled={busy||locked} onChange={e=>setLikes(Number(e.target.value))}>{tiers.map(([n,c])=><option key={n} value={n}>{n} · ${(c/100).toFixed(2)}/month</option>)}</select></label>
 <p>First scheduled charge: {config.startDate}. Renews monthly until canceled. Creating a subscription does not prove payment.</p>
 <label><input type="checkbox" checked={consent} disabled={busy||locked} onChange={e=>setConsent(e.target.checked)}/> I authorize the displayed sandbox monthly subscription and understand future renewals can be canceled from my account.</label>
 <PremiumInlineCheckout cardReady={ready} busy={busy} canPay={consent&&!locked} buttonLabel={busy?'Processing…':`Create sandbox subscription · $${(cents/100).toFixed(2)}/month`}/>
 </form><p role="status">{message}</p></section></main>
}
