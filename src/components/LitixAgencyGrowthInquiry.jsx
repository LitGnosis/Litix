"use client";
import {useEffect,useState} from "react";
import {buildAgencyLeadPayload,AGENCY_SEGMENTS,AGENCY_GOALS,AGENCY_BUDGETS} from "../lib/litixAgencyLead.mjs";
import {PARTNER_SOURCE_FIELDS} from "../lib/litixPartnerAttribution.mjs";

const empty={name:"",email:"",organization:"",segment:"business",goal:"leads",budget:"from_1000",notes:"",consent:false,websiteTrap:""};
const choices=values=>Object.entries(values).map(([value,title])=><option key={value} value={value}>{title}</option>);
export default function LitixAgencyGrowthInquiry(){
 const [value,setValue]=useState(empty);
 const [source,setSource]=useState({});
 const [status,setStatus]=useState("idle");
 const [message,setMessage]=useState("");
 const update=(key,data)=>setValue(old=>({...old,[key]:data}));
 useEffect(()=>{
  const query=new URLSearchParams(window.location.search);
  setSource(Object.fromEntries(PARTNER_SOURCE_FIELDS.map(key=>[key,query.get(key)])));
 },[]);
 async function submit(e){
  e.preventDefault();
  if(status==="sending")return;
  setStatus("sending");setMessage("");
  try{
   const payload=buildAgencyLeadPayload(value,source);
   const response=await fetch("/api/partners",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(payload),cache:"no-store",signal:AbortSignal.timeout(12000)
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||"Your inquiry could not be delivered.");
   setStatus("sent");
   setMessage("Your business inquiry was submitted for manual review. No payment or service order was created. Litix will contact you if we can offer a suitable proposal.");
   setValue(empty);
  }catch(error){
   setStatus("error");
   setMessage(error?.message||"Submission unavailable. Contact litixsocial@gmail.com.");
  }
 }
 return <form className="agency-lead-form partner-form" aria-label="Request a Litix business growth proposal" onSubmit={submit}>
  <div className="partner-fields">
   <label>Your name<input type="text" autoComplete="name" required minLength={2} maxLength={100}
    value={value.name} onChange={e=>update("name",e.target.value)}/></label>
   <label>Work email<input type="email" autoComplete="email" required maxLength={254}
    value={value.email} onChange={e=>update("email",e.target.value)}/></label>
   <label>Company or brand (optional)<input type="text" autoComplete="organization" maxLength={120}
    value={value.organization} onChange={e=>update("organization",e.target.value)}/></label>
   <label>Business type<select value={value.segment} onChange={e=>update("segment",e.target.value)}>
    {choices(AGENCY_SEGMENTS)}</select></label>
   <label>Priority<select value={value.goal} onChange={e=>update("goal",e.target.value)}>
    {choices(AGENCY_GOALS)}</select></label>
   <label>Estimated monthly marketing budget<select value={value.budget} onChange={e=>update("budget",e.target.value)}>
    {choices(AGENCY_BUDGETS)}</select></label>
  </div>
  <label>Anything else we should know? (optional)
   <textarea rows={3} maxLength={300} placeholder="A short description of your project. Do not include passwords or private customer information."
    value={value.notes} onChange={e=>update("notes",e.target.value)}/>
  </label>
  <div className="partner-honeypot" aria-hidden="true">
   <label>Leave blank<input tabIndex={-1} autoComplete="off" value={value.websiteTrap} onChange={e=>update("websiteTrap",e.target.value)}/></label>
  </div>
  <label className="partner-consent"><input type="checkbox" required checked={value.consent}
   onChange={e=>update("consent",e.target.checked)}/>
   I consent to Litix contacting me about this specific inquiry. <a href="/legal/privacy">Privacy policy</a>.
  </label>
  <button type="submit" className="primary partner-submit" disabled={status==="sending"}>{status==="sending"?"Submitting…":"Request a business proposal"}</button>
  <p role="status" aria-live="polite" className={status==="error"?"partner-error":"partner-result"}>{message}</p>
  <p className="small">No commitment, payment or account activation. All work is subject to review, agreed scope, availability and applicable platform rules. Prefer email? <a href="mailto:litixsocial@gmail.com?subject=Litix%20Business%20Growth%20Inquiry">Contact Litix</a>.</p>
 </form>;
}
