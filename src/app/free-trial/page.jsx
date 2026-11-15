"use client";
import {useEffect,useRef,useState} from "react";
function TrialTurnstile({siteKey,onToken}){
 const box=useRef(null);
 useEffect(()=>{
  if(!siteKey||!box.current)return;
  let widget=null,disposed=false;
  const render=()=>{if(disposed||!box.current||!window.turnstile)return;
   widget=window.turnstile.render(box.current,{sitekey:siteKey,
    callback:onToken,"expired-callback":()=>onToken(""),"error-callback":()=>onToken("")});};
  if(window.turnstile)render();
  else{
   const script=document.createElement("script");
   script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
   script.async=true;script.defer=true;script.onload=render;document.head.appendChild(script);
  }
  return()=>{disposed=true;if(widget!==null)window.turnstile?.remove(widget);};
 },[siteKey,onToken]);
 return <div ref={box} aria-label="CAPTCHA verification"/>;
}
export default function FreeTrial(){
 const enabled=process.env.NEXT_PUBLIC_LITIX_FREE_TRIAL_ENABLED==="true";
 const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||"";
 const [platform,setPlatform]=useState("instagram");
 const [kind,setKind]=useState("likes");
 const [username,setUsername]=useState("");
 const [postUrl,setPostUrl]=useState("");
 const [email,setEmail]=useState("");
 const [marketingConsent,setMarketingConsent]=useState(false);
 const [token,setToken]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState("");
 async function submit(e){
  e.preventDefault();if(busy||!enabled||!token)return;
  setBusy(true);setResult("");
  try{
   const r=await fetch("/api/free-trial",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({platform,kind,username,postUrl,email,marketingConsent,turnstileToken:token})});
   const b=await r.json();
   setResult(b.message||b.error||"Trial is temporarily unavailable.");
  }catch{setResult("Trial is temporarily unavailable. No payment was taken.")}
  finally{setBusy(false);setToken("");}
 }
 return <main className="wrap" style={{maxWidth:730,paddingTop:24}}>
  <section className="panel"><p className="kicker">LITIX · CREATOR TRIAL</p>
   <h1>Try 20 free Likes or Views</h1>
   <p>One eligible public post, no social password and no card payment. One trial per IP address, email and social profile in a rolling 30-day window. Delivery is subject to current availability.</p>
   {!(enabled&&siteKey)?<p role="status">The free trial is not accepting claims right now. You can still <a href="/">browse Litix packages</a>.</p>:
   <form onSubmit={submit} className="form">
    <label>Platform<select value={platform} onChange={e=>setPlatform(e.target.value)}>
      <option value="instagram">Instagram</option><option value="tiktok">TikTok</option>
    </select></label>
    <label>Trial type<select value={kind} onChange={e=>setKind(e.target.value)}>
      <option value="likes">20 Likes</option><option value="views">20 Views</option>
    </select></label>
    <label>Public username or profile URL<input required maxLength={180} autoComplete="off" value={username}
      placeholder="@username" onChange={e=>setUsername(e.target.value)}/></label>
    <label>Public post or video URL<input required type="url" maxLength={1100} value={postUrl}
      placeholder={platform==="instagram"?"https://www.instagram.com/p/...":"https://www.tiktok.com/@user/video/..."}
      onChange={e=>setPostUrl(e.target.value)}/></label>
    <label>Email for trial status<input required type="email" maxLength={254} value={email}
      placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/></label>
    <label style={{display:"flex",alignItems:"start",gap:10}}>
      <input type="checkbox" checked={marketingConsent} onChange={e=>setMarketingConsent(e.target.checked)}/>
      <span>Optional: email me Litix offers. I can unsubscribe at any time.</span>
    </label>
    <TrialTurnstile siteKey={siteKey} onToken={setToken}/>
    <button type="submit" className="primary" disabled={busy||!token}>{busy?"Submitting…":"Claim my free trial"}</button>
    {result&&<p role="status" aria-live="polite">{result}</p>}
    <p className="small">Your information is processed for trial eligibility and delivery. See our <a href="/legal/privacy">Privacy Policy</a>.</p>
   </form>}
  </section>
 </main>;
}
