'use client';
import {useEffect,useState} from 'react';
const money=(c,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(c/100);
export default function CustomerDashboard({email}){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{const abort=new AbortController();fetch('/api/account/dashboard',{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error);setData(v)}).catch(e=>{if(!abort.signal.aborted)setError(e.message)});return()=>abort.abort()},[]);
 async function cancel(id){if(!window.confirm("Stop future renewals? Current verified paid coverage continues until its end date."))return;try{const r=await fetch('/api/account/subscriptions/'+encodeURIComponent(id)+'/cancel',{method:'POST'});const v=await r.json();if(!r.ok)throw Error(v.error);setError(v.message);setData(old=>({...old,subscriptions:old.subscriptions.map(s=>s.id===id?{...s,cancellation_state:v.cancellationState}:s)}))}catch(e){setError(e.message)}}
 return <main className="wrap"><nav className="nav"><a href="/">Storefront</a><a href="/auth/logout">Sign out</a></nav><section className="panel"><h1>Your account</h1><p>{email} · Verified email</p><p role="status">{error||(!data?'Loading records…':'Records are scoped to your signed-in identity.')}</p>
 {data&&<><h2>Subscriptions</h2>{data.subscriptions.length?data.subscriptions.map(s=><article key={s.id}><h3>{s.likes_per_post} likes per post · {money(s.amount_cents,s.currency)}/month</h3><p>{s.billing_state} · Cancellation: {s.cancellation_state}</p><p>Paid through: {s.paid_through||'No verified payment'}</p><button className="alt" disabled={s.cancellation_state!=="none"} onClick={()=>cancel(s.id)}>Cancel future renewals</button></article>):<p>No subscriptions linked to this account.</p>}
 <h2>Payments</h2>{data.payments.length?data.payments.map(p=><p key={p.transaction_id}>{money(p.amount_cents,p.currency)} · {p.transaction_id} · {p.verified_at}</p>):<p>No verified payments.</p>}
 <h2>Orders</h2>{data.orders.length?data.orders.map(o=><p key={o.order_id}>{o.order_id}</p>):<p>No orders linked. Existing private tracking links still work; orders are not claimed by email alone.</p>}
 <h2>Fulfillment</h2>{data.fulfillment.length?data.fulfillment.map(p=><p key={p.post_id}>{p.post_id} · {p.state} · Supplier order: {p.supplier_order_id||'Not submitted'}</p>):<p>No fulfillment recorded.</p>}
 <h2>Account settings</h2><p>Passwords and recovery are managed by the identity provider. Sign out and use “Forgot password” on its login screen. No passwords or card details are stored by this dashboard.</p></>}
 </section></main>
}
