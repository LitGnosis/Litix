"use client";
import {useEffect,useState} from 'react';
import {AUTO_LIKES_TIERS, OPTIONAL_METRICS, calculatePreviewQuote, dollars} from './offer.mjs';
function ExistingCampaigns(){
 const [campaigns,setCampaigns]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[signedOut,setSignedOut]=useState(false);
 async function load(){try{const r=await fetch('/api/auto-boost',{cache:'no-store'});if(r.status===401){setSignedOut(true);return;}const j=await r.json();if(!r.ok)throw Error(j.error||'Unable to load automations');setCampaigns(j.campaigns||[]);}catch(e){setError(e.message);}}
 useEffect(()=>{load();},[]);
 async function toggle(c){setBusy(true);setError('');try{const r=await fetch('/api/auto-boost',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:c.id,status:c.status==='active'?'paused':'active'})});const j=await r.json();if(!r.ok)throw Error(j.error||'Unable to update automation');await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="section"><h2>Your existing automations</h2>{signedOut?<a href="/signin?next=/auto-boost">Sign in to manage automations</a>:campaigns.length?campaigns.map(c=><article className="chip" key={c.id}><b>{c.platform} · {Number(c.quantity_per_post).toLocaleString('en-US')} per new post</b><p>{c.status} · max {c.max_posts_per_month}/month</p>{c.status!=='stopped'&&<button type="button" disabled={busy} onClick={()=>toggle(c)}>{c.status==='active'?'Pause':'Resume'}</button>}</article>):<p>No existing automations to display.</p>}{error&&<p role="alert">{error}</p>}</section>;
}
export default function AutoBoostClient(){
 const [likes,setLikes]=useState(100),[extras,setExtras]=useState({shares:0,reposts:0,saves:0});
 let quote,error;try{quote=calculatePreviewQuote({likes,...extras});}catch(e){error=e.message;}
 return <div className="boostPreview"><div className="shell"><section className="panel">
 <span className="pill">Instagram · Automatic Likes · Preview</span>
 <h2>Set it once. Boost each new post.</h2>
 <p>Preview automatic likes with 3× video views on eligible video posts only. Photo posts do not include video views. Delivery is not enabled yet.</p>
 <div className="section"><label htmlFor="boost-account">Account name</label><input id="boost-account" placeholder="@youraccount" autoComplete="off"/></div>
 <div className="section"><label>Likes per new post</label><div className="tiers" role="group" aria-label="Likes per post">{AUTO_LIKES_TIERS.map(t=><button type="button" className="tier" key={t.likes} aria-pressed={likes===t.likes} onClick={()=>setLikes(t.likes)}>{t.likes.toLocaleString('en-US')}<span>{dollars(t.priceCents)}</span></button>)}</div></div>
 <div className="section"><div className="extras">{OPTIONAL_METRICS.map(key=><div className="chip" key={key}><label htmlFor={'boost-'+key}>{key[0].toUpperCase()+key.slice(1)} / post</label><input id={'boost-'+key} type="number" min="0" max="1000000" step="1" value={extras[key]} onChange={e=>setExtras({...extras,[key]:e.target.value})}/></div>)}</div><p className="muted">Optional add-ons use snapshot rates, not a live checkout quote.</p></div>
 <div className="extras"><div className="chip"><label>Likes / post</label><b>{likes.toLocaleString('en-US')}</b></div><div className="chip"><label>Video views / post</label><b>{(likes*3).toLocaleString('en-US')}</b></div><div className="chip"><label>Delivery</label>New posts</div></div>
 <div className="price" aria-live="polite"><div className="muted">Illustrative package price</div><div className="amount">{quote?dollars(quote.previewTotalCents):'Unavailable'}</div>{error?<p role="alert">{error}</p>:<><div className="breakdown"><span>Likes + eligible video views</span><strong>{dollars(quote.baseCents)}</strong></div><div className="breakdown"><span>Add-ons (up to 90 posts, estimate)</span><strong>{dollars(quote.addOnsEstimateCents)}</strong></div></>}<p className="muted">Confirmed $7 package: 100 likes per new post for 30 days, up to 3 posts daily (90 total). Eligible video posts include 300 views. Other tier coverage and add-on prices remain estimates until verified.</p></div>
 <button className="btn" disabled>Preview only — Checkout not enabled</button><p className="warn">No payments or orders are submitted. Instagram discovery, supplier routing, bundled views and billing need verification. TikTok and X packages are not included in this preview.</p>
 <ExistingCampaigns/></section></div></div>;
}
