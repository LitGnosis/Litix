"use client";
import {useEffect,useState} from "react";
import {cleanPartnerAttribution,PARTNER_SOURCE_FIELDS} from "../lib/litixPartnerAttribution.mjs";
const initial = {name:"", email:"", organization:"", website:"", type:"agency", goals:"", consent:false, websiteTrap:"", attribution:{}};
export default function PartnerApplication(){
  const [form,setForm]=useState(initial);
  // Only partner-inquiry campaign tags. No persistent tracking cookie or fingerprint.
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search);
    const raw=Object.fromEntries(PARTNER_SOURCE_FIELDS.map(key=>[key,query.get(key)]));
    const attribution=cleanPartnerAttribution(raw);
    setForm(f=>({...f,attribution}));
  },[]);
  const [status,setStatus]=useState("idle");
  const [message,setMessage]=useState("");
  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function submit(event){
    event.preventDefault();
    if(status==="sending")return;
    setStatus("sending");setMessage("");
    try{
      const response=await fetch("/api/partners",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(payload.error||"Application could not be sent.");
      setStatus("success");
      setMessage(payload.acknowledgementQueued?"Thank you. Your inquiry was submitted for manual review, and a confirmation email was queued. No partnership or commission is active yet.":"Thank you. Your inquiry was submitted for manual review. No partnership or commission is active yet. If you do not hear back, contact litixsocial@gmail.com.");
      setForm(initial);
    }catch(error){
      setStatus("error");
      setMessage(error?.message||"Application could not be sent. Please email litixsocial@gmail.com.");
    }
  }
  return <form className="partner-form" onSubmit={submit} aria-label="Litix partner application">
    <div className="partner-fields">
      <label>Full name <input type="text" required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={e=>update("name",e.target.value)} /></label>
      <label>Business email <input type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={e=>update("email",e.target.value)} /></label>
      <label>Organization (optional) <input type="text" maxLength={120} autoComplete="organization" value={form.organization} onChange={e=>update("organization",e.target.value)} /></label>
      <label>Website (optional) <input type="url" maxLength={300} placeholder="https://yourbusiness.com" value={form.website} onChange={e=>update("website",e.target.value)} /></label>
      <label>I'm interested in
        <select required value={form.type} onChange={e=>update("type",e.target.value)}>
          <option value="agency">Agency / reseller partnership</option>
          <option value="affiliate">Referral / affiliate pilot</option>
          <option value="reviewer">Independent reviewer / creator</option>
          <option value="business">Business collaboration</option>
          <option value="publisher">Creator / publisher campaign partnership</option>
        </select>
      </label>
    </div>
    <label>Tell us about your audience or partnership idea
      <textarea required minLength={10} maxLength={1000} rows={5} value={form.goals} onChange={e=>update("goals",e.target.value)} placeholder="Who do you serve, and what kind of partnership are you proposing?" />
    </label>
    <div className="partner-honeypot" aria-hidden="true"><label>Leave this blank<input tabIndex={-1} autoComplete="off" value={form.websiteTrap} onChange={e=>update("websiteTrap",e.target.value)} /></label></div>
    <label className="partner-consent"><input type="checkbox" required checked={form.consent} onChange={e=>update("consent",e.target.checked)}/> I agree Litix can contact me about this inquiry. See the <a href="/legal/privacy">privacy policy</a>.</label>
    <button className="primary partner-submit" type="submit" disabled={status==="sending"}>{status==="sending"?"Sending inquiry…":"Request partnership review"}</button>
    <p role="status" aria-live="polite" className={status==="error"?"partner-error":"partner-result"}>{message}</p>
    <p className="small">Prefer email? <a href="mailto:litixsocial@gmail.com?subject=Litix%20Partnership%20Inquiry">Contact the Litix partnerships team</a>.</p>
  </form>;
}
