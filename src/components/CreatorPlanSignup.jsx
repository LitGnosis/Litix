"use client";
import {useState} from "react";

export default function CreatorPlanSignup(){
 const [email,setEmail]=useState("");
 const [consent,setConsent]=useState(false);
 const [websiteTrap,setWebsiteTrap]=useState("");
 const [pending,setPending]=useState(false);
 const [notice,setNotice]=useState("");
 async function submit(event){
  event.preventDefault();
  if(pending)return;
  setPending(true);setNotice("");
  const params=new URLSearchParams(window.location.search);
  const attribution={};
  for(const name of ["utm_source","utm_medium","utm_campaign","utm_content","ref"]){
   if(params.has(name))attribution[name]=params.get(name);
  }
  try{
   const resp=await fetch("/api/creator-signup",{
    method:"POST",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({email,consent,websiteTrap,attribution})
   });
   const body=await resp.json();
   if(!resp.ok)throw Error(body.error||"The signup form is temporarily unavailable.");
   setNotice("If your address is eligible, check your inbox for a confirmation link. No purchase or recurring subscription was created.");
   setEmail("");setConsent(false);
  }catch(e){setNotice(e?.message||"Please try again later.");}
  finally{setPending(false);}
 }
 return <aside aria-label="Email my Litix creator planner link" style={{marginTop:20,padding:20,border:"1px solid currentColor",borderRadius:12}}>
  <h3>Get the free Litix planner link</h3>
  <p className="small">Starting fresh or restarting your page? Request one email with a link to the browser-based Litix Content Calendar.</p>
  <form onSubmit={submit} style={{display:"grid",gap:12,maxWidth:480}}>
   <label>Email address<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
   <label style={{display:"flex",gap:10,alignItems:"start"}}>
    <input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} style={{width:18,height:18,marginTop:4}}/>
    <span>I request one email to confirm access to the free planner. This does not enroll me in promotional emails or create a paid order.</span>
   </label>
   <label style={{position:"absolute",left:"-9999px"}} aria-hidden="true">Company website<input type="text" tabIndex={-1} autoComplete="off" value={websiteTrap} onChange={e=>setWebsiteTrap(e.target.value)}/></label>
   <button type="submit" className="primary" disabled={pending}>{pending?"Sending…":"Send my planner link"}</button>
  </form>
  {notice&&<p role="status" aria-live="polite" className="small">{notice}</p>}
  <p className="small">No account is created. The calendar saves your plans on your own device. <a href="/legal/privacy">Privacy</a>.</p>
 </aside>;
}
