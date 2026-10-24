'use client';
import { useState } from 'react';
export default function AutoEngagement() {
 const [platform,setPlatform]=useState('Instagram'),[username,setUsername]=useState('');
 const [min,setMin]=useState('100'),[max,setMax]=useState('500'),[posts,setPosts]=useState('10');
 const [result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const change=setter=>event=>{setter(event.target.value);setResult(null);setError('')};
 async function review(event){
  event.preventDefault();setBusy(true);setResult(null);setError('');
  try{
   const response=await fetch('/api/auto-engagement/v1',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(10000),body:JSON.stringify({executionAction:'validateDraft',platform,username,minLikes:Number(min),maxLikes:Number(max),posts:Number(posts)})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to review draft.');setResult(data.draft);
  }catch(e){setError(e.name==='TimeoutError'?'Draft review timed out. No payment or supplier request was sent.':e.message)}finally{setBusy(false)}
 }
 return <main className="wrap"><nav className="nav"><a href="/">← Single-order storefront</a></nav>
  <section className="panel" style={{maxWidth:720,margin:'24px auto'}}>
   <div className="kicker">PREVIEW · NOT ACTIVE</div><h1>Auto Engagement setup</h1><p><a href="/auto-engagement/sandbox">Test monthly plans, daily limits and cancellation — sandbox only →</a></p>
   <p>Plan likes and views for future posts. This draft tool does not monitor profiles, charge cards, or create supplier subscriptions.</p>
   <p className="small">The 3:1 views-to-likes ratio is a quantity preference—not evidence of organic activity, natural timing, or improved algorithmic reach. Supplier limits and eligibility are not yet verified.</p>
   <form className="form" onSubmit={review}>
    <label>Platform<select value={platform} onChange={change(setPlatform)}><option>Instagram</option><option>TikTok</option></select></label>
    <label>Account username<input required maxLength={31} autoComplete="off" value={username} onChange={change(setUsername)} placeholder="@youraccount"/></label>
    <label>Minimum likes per post<input required type="number" min="1" max="100000" step="1" value={min} onChange={change(setMin)}/></label>
    <label>Maximum likes per post<input required type="number" min="1" max="100000" step="1" value={max} onChange={change(setMax)}/></label>
    <label>Future posts to cover<input required type="number" min="1" max="100" step="1" value={posts} onChange={change(setPosts)}/></label>
    <button type="submit" className="primary" disabled={busy}>{busy?'Reviewing…':'Review draft — no payment'}</button>
   </form>
   {error&&<p role="alert" className="msg">{error}</p>}
   {result&&<section className="msg" aria-live="polite"><h2>Draft review</h2>
    <p>{result.platform} · @{result.username} · {result.posts} future posts requested</p>
    <p>Likes: {result.likes.min.toLocaleString()}–{result.likes.max.toLocaleString()} per post · Not submitted</p>
    <p>Views: {result.views.min.toLocaleString()}–{result.views.max.toLocaleString()} per post · Not submitted</p>
    <p><strong>USD price unavailable — purchasing disabled.</strong> No amount is guessed and no payment is collected.</p>
    <h3>Required before activation</h3><ul>{result.blockers.map(item=><li key={item}>{item}</li>)}</ul>
    <p>This draft is not saved. No subscription was activated.</p>
   </section>}
  </section></main>;
}
