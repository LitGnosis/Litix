"use client";
import {useState} from "react";
const initial={name:"",email:"",organization:"",budget:"unsure",goals:"",consent:false,faxTrap:""};
export default function LitixSolutionsInquiry({solution}){
 const [data,setData]=useState(initial);
 const [state,setState]=useState("idle");
 const [notice,setNotice]=useState("");
 const set=(k,v)=>setData(o=>({...o,[k]:v}));
 async function send(e){
  e.preventDefault();
  if(state==="sending")return;
  setState("sending");setNotice("");
  try{
   const r=await fetch("/api/solutions/inquiry",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...data,solution})});
   const payload=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(payload.error||"Unable to submit inquiry.");
   setData(initial);setNotice(payload.message||"Request received for manual review.");setState("sent");
  }catch(e){setNotice(e?.message||"Unable to send your request. Email litixsocial@gmail.com.");setState("error")}
 }
 return <form className="ls-form" onSubmit={send} aria-label="Litix solutions inquiry">
  <div className="ls-fields">
   <label>Name <input autoComplete="name" value={data.name} onChange={e=>set("name",e.target.value)} minLength={2} maxLength={100} required /></label>
   <label>Contact email <input type="email" autoComplete="email" value={data.email} onChange={e=>set("email",e.target.value)} maxLength={254} required /></label>
   <label>Business / creator name (optional) <input value={data.organization} onChange={e=>set("organization",e.target.value)} maxLength={120} autoComplete="organization" /></label>
   <label>Estimated budget
    <select value={data.budget} onChange={e=>set("budget",e.target.value)} required>
     <option value="unsure">Not sure yet</option>
     <option value="under-250">Under $250</option>
     <option value="250-999">$250–$999</option>
     <option value="1000-4999">$1,000–$4,999</option>
     <option value="5000-plus">$5,000+</option>
    </select>
   </label>
  </div>
  <label>What are you hoping to accomplish?
   <textarea rows={5} required minLength={12} maxLength={1500} value={data.goals} onChange={e=>set("goals",e.target.value)} placeholder="Describe your project, target audience, timeline and the help you need. Please don't include passwords or private customer records." />
  </label>
  <div className="ls-hidden" aria-hidden="true"><label>Leave blank<input tabIndex={-1} autoComplete="off" value={data.faxTrap} onChange={e=>set("faxTrap",e.target.value)}/></label></div>
  <label className="ls-consent"><input type="checkbox" checked={data.consent} onChange={e=>set("consent",e.target.checked)} required /> I agree Litix may contact me regarding this request. Read the <a href="/legal/privacy">privacy policy</a>.</label>
  <button type="submit" disabled={state==="sending"} className="ls-cta">{state==="sending"?"Sending…":"Request a proposal"}</button>
  <p role="status" aria-live="polite" className={state==="error"?"ls-error":"ls-success"}>{notice}</p>
  <p className="ls-note">Manual review only. No checkout, subscription, account or order is created. <a href="mailto:litixsocial@gmail.com?subject=Litix%20Solutions%20Inquiry">Email Litix instead</a>.</p>
 </form>;
}
