'use client';
import {useState} from 'react';
import {plans,signup,cancel,renew,coverPost} from '../../../lib/subscription-sandbox.mjs';
const usd=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export default function Sandbox(){
 const [likes,setLikes]=useState(100),[consent,setConsent]=useState(false),[state,setState]=useState(null),[now,setNow]=useState('2026-01-31T12:00:00.000Z'),[message,setMessage]=useState(''),[post,setPost]=useState('post-1');
 function run(fn){try{setState(fn());setMessage('Simulation updated. No real payment or supplier order sent.')}catch(e){setMessage(e.message)}}
 return <main className="wrap"><a href="/auto-engagement">← Draft setup</a><section className="panel" style={{maxWidth:720,margin:'24px auto'}}>
 <div className="kicker">SANDBOX ONLY · NO REAL BILLING</div><h1>Monthly subscription simulator</h1>
 <p>Test pricing, renewal, cancellation and daily allowances. Everything stays in this page’s memory and resets on reload. This is not a customer account or a working payment integration.</p>
 <p>Proposed Instagram plans: selected likes per eligible post, up to 3 posts per UTC calendar day. Video views and supplier eligibility remain unverified and are not included in this simulation.</p>
 <label>Monthly plan<select disabled={!!state} value={likes} onChange={e=>setLikes(Number(e.target.value))}>{plans.map(p=><option key={p.likes} value={p.likes}>{p.likes.toLocaleString()} likes/post — {usd(p.cents)}/month</option>)}</select></label>
 <label style={{display:'block',margin:'16px 0'}}><input style={{width:'auto'}} type="checkbox" disabled={!!state} checked={consent} onChange={e=>setConsent(e.target.checked)}/> I agree to the simulated monthly price and automatic renewal until canceled. Cancellation stops future renewals; current paid coverage continues until the period ends.</label>
 {!state?<button className="primary" onClick={()=>run(()=>signup(likes,consent,now))}>Simulate subscribe — no charge</button>:<>
 <h2>{usd(state.amountCents)}/month · {state.status}</h2><p>Simulation clock: {now}</p><p>Paid through: {state.periodEnd}</p><p>Automatic renewal: {state.autoRenew?'On':'Off'} · Simulated successful charges: {state.charges}</p>
 <p>Simulated covered posts: {state.deliveries.length}</p>
 <label>Post ID<input value={post} onChange={e=>setPost(e.target.value)}/></label>
 <button className="alt" onClick={()=>run(()=>coverPost(state,post,now))}>Simulate new post</button>{' '}
 <button className="alt" onClick={()=>{setNow(new Date(new Date(now).getTime()+86400000).toISOString());setMessage('Simulation clock advanced one day.')}}>Advance one UTC day</button>
 <h3>Manage subscription</h3><button className="alt" disabled={!state.autoRenew} onClick={()=>run(()=>cancel(state))}>Cancel subscription — simulation</button>
 {!state.autoRenew&&<p role="status">Cancellation confirmed in simulation. No future renewals. Current coverage ends {state.periodEnd}.</p>}
 <p><button className="alt" onClick={()=>{setNow(state.periodEnd);run(()=>renew(state,state.periodEnd,true))}}>Simulate next renewal — approved</button>{' '}<button className="alt" onClick={()=>{setNow(state.periodEnd);run(()=>renew(state,state.periodEnd,false))}}>Simulate next renewal — declined</button></p>
 </>}
 <p role="status">{message}</p><button className="alt" onClick={()=>{setState(null);setConsent(false);setNow('2026-01-31T12:00:00.000Z');setMessage('Simulation reset.')}}>Reset simulation</button>
 <p className="small">Not live: recurring gateway access, account authentication, billing emails, supplier support, durable settlement deduplication and real cancellation still need integration and sandbox verification.</p>
 </section></main>
}
