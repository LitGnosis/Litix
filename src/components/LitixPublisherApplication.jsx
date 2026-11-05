"use client";
import {useState} from "react";
import {buildLitixPublisherInquiry} from "../lib/litixNativePublisherInquiry.mjs";

const empty={
 name:"",email:"",organization:"",website:"",channel:"instagram",
 format:"original_content",regions:"",niche:"",experience:"",
 consent:false,rightsConfirmed:false,disclosureConfirmed:false,websiteTrap:""
};
const channelOptions=[
 ["instagram","Instagram"],["tiktok","TikTok"],["youtube","YouTube"],
 ["x","X"],["facebook","Facebook"],["linkedin","LinkedIn"],
 ["newsletter","Newsletter"],["website","Website"],["search","Search"],["other","Other"]
];
const formatOptions=[
 ["original_content","Original licensed creative content"],
 ["sponsored_post","Disclosed creator-sponsored placement"],
 ["newsletter_sponsorship","Newsletter sponsorship"],
 ["website_placement","Publisher website placement"],
 ["campaign_reporting","Genuine campaign reporting"],
 ["managed_ads","Authorized advertising management"]
];
export default function LitixPublisherApplication(){
 const [data,setData]=useState(empty);
 const [status,setStatus]=useState("idle");
 const [message,setMessage]=useState("");
 const change=(name,val)=>{
  setData(x=>({...x,[name]:val}));
  if(status==="done")setStatus("idle");
 };
 async function submit(e){
  e.preventDefault();
  if(status==="sending")return;
  const checked=buildLitixPublisherInquiry(data);
  if(!checked.ok){setStatus("error");setMessage(checked.error||"Please complete the form.");return;}
  setStatus("sending");setMessage("");
  try{
   const r=await fetch("/api/partners",{
    method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({...checked.data,consent:true,websiteTrap:data.websiteTrap})
   });
   const result=await r.json().catch(()=>({}));
   if(!r.ok||result.ok!==true)throw Error(result.error||"Couldn't submit the application.");
   setStatus("done");
   setMessage("Your creator/publisher proposal was sent for manual review. This does not create an approved service, order, or paid partnership.");
   setData(empty);
  }catch(err){setStatus("error");setMessage(err.message||"Submission unavailable. Please retry later.");}
 }
 return <form onSubmit={submit} className="ls-panel" id="apply">
  <h2>Apply to the Litix Creator & Publisher Network</h2>
  <p>Share real campaign capacity, distribution rights and proposed services. Submitting this form does not guarantee acceptance, payment, or a contract.</p>
  <div className="ls-tool-fields">
   <label>Contact name <input required maxLength={100} value={data.name} onChange={e=>change("name",e.target.value)}/></label>
   <label>Professional email <input type="email" required maxLength={254} value={data.email} onChange={e=>change("email",e.target.value)}/></label>
   <label>Agency or creator business <input maxLength={120} value={data.organization} onChange={e=>change("organization",e.target.value)}/></label>
   <label>Public portfolio or channel URL <input type="url" maxLength={300} placeholder="https://example.com/portfolio" value={data.website} onChange={e=>change("website",e.target.value)}/></label>
   <label>Main publishing channel
    <select value={data.channel} onChange={e=>change("channel",e.target.value)}>
     {channelOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}
    </select>
   </label>
   <label>Genuine service you can supply
    <select value={data.format} onChange={e=>change("format",e.target.value)}>
     {formatOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}
    </select>
   </label>
   <label>Countries or regions served <input required maxLength={120} placeholder="United States, Mexico, Canada" value={data.regions} onChange={e=>change("regions",e.target.value)}/></label>
   <label>Audience, topic or niche <input required maxLength={150} placeholder="Independent beauty creators and small retailers" value={data.niche} onChange={e=>change("niche",e.target.value)}/></label>
   <label>Describe your actual deliverable, lead time, and evidence
    <textarea required minLength={12} maxLength={350} rows={4}
     value={data.experience} onChange={e=>change("experience",e.target.value)}
     placeholder="I create original sponsored demos, and I can provide a public portfolio, campaign terms and post-delivery reporting."/>
   </label>
   <div style={{position:"absolute",width:1,height:1,overflow:"hidden"}} aria-hidden="true">
    <label>Leave empty <input tabIndex={-1} value={data.websiteTrap} onChange={e=>change("websiteTrap",e.target.value)} autoComplete="off"/></label>
   </div>
   <label><input type="checkbox" required checked={data.rightsConfirmed} onChange={e=>change("rightsConfirmed",e.target.checked)}/> I have the necessary rights or permissions for the proposed content and placements.</label>
   <label><input type="checkbox" required checked={data.disclosureConfirmed} onChange={e=>change("disclosureConfirmed",e.target.checked)}/> I can make required sponsorship disclosures and will not offer fake engagement or guaranteed platform metrics.</label>
   <label><input type="checkbox" required checked={data.consent} onChange={e=>change("consent",e.target.checked)}/> I consent to Litix contacting me about this application.</label>
  </div>
  <button className="ls-cta" type="submit" disabled={status==="sending"}>
   {status==="sending"?"Sending application…":"Apply for supplier review"}
  </button>
  <p role="status" aria-live="polite" className="ls-note">{message}</p>
 </form>;
}
