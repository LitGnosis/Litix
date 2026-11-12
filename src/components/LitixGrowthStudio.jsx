"use client";
import {useMemo,useState} from "react";
import {GROWTH_CHANNELS,buildNativeGrowthKit,weeklySalesRunRate} from "../lib/litixNativeGrowthEngine.mjs";

const initial={
 brand:"Litix",campaign:"business-workflow",audience:"service businesses and agencies",
 pain:"missed customer inquiries and scattered follow-up",
 solution:"consent-based lead response and a reviewed content workflow",
 proof:"",cta:"Request a scoped proposal",
 landingUrl:"https://www.litix.net/agency-growth"
};
export default function LitixGrowthStudio(){
 const [brief,setBrief]=useState(initial);
 const [kit,setKit]=useState(null);
 const [error,setError]=useState("");
 const [platform,setPlatform]=useState("instagram");
 const [copyNotice,setCopyNotice]=useState("");
 const [retainer,setRetainer]=useState(4000);
 const forecast=useMemo(()=>{try{return weeklySalesRunRate({monthlyRetainer:retainer})}catch{return null}},[retainer]);
 const visible=kit?.variants.filter(v=>v.platform===platform)||[];
 function field(name,value){setBrief(current=>({...current,[name]:value}));}
 function generate(e){e.preventDefault();setCopyNotice("");try{setKit(buildNativeGrowthKit(brief));setError("");}catch(err){setKit(null);setError(err.message)}}
 async function copy(text){
  try{await navigator.clipboard.writeText(text);setCopyNotice("Copied to clipboard.");}
  catch{setCopyNotice("Copy is unavailable here; select the draft text manually.");}
 }
 function exportKit(){
  if(!kit)return;
  const data=JSON.stringify(kit,null,2);
  const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="litix-"+kit.campaign+"-drafts.json";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="studio">
  <section className="panel studio-hero">
   <p className="kicker">LITIX · FIRST-PARTY TECHNOLOGY</p>
   <h1>One campaign brief. Twelve platform-ready creative drafts.</h1>
   <p>Plan original creative for four channels, prepare shot lists and build source-tagged links—inside Litix. No Butter subscription, external AI key or client social password required.</p>
   <p className="small">This first release prepares scripts and captions, not finished videos or automatic posts. Account publishing and delivered-work verification require separate approved integrations.</p>
  </section>
  <section className="panel studio-columns">
   <form onSubmit={generate} className="studio-form">
    <h2>1. Build the brief</h2>
    <label>Business or brand<input value={brief.brand} maxLength={70} onChange={e=>field("brand",e.target.value)} required/></label>
    <label>Campaign name<input value={brief.campaign} maxLength={80} onChange={e=>field("campaign",e.target.value)} required/></label>
    <label>Target customer<input value={brief.audience} maxLength={120} onChange={e=>field("audience",e.target.value)} required/></label>
    <label>Customer problem<textarea rows={2} maxLength={140} value={brief.pain} onChange={e=>field("pain",e.target.value)} required/></label>
    <label>Useful solution or offer<textarea rows={2} maxLength={180} value={brief.solution} onChange={e=>field("solution",e.target.value)} required/></label>
    <label>Verified evidence (optional)<textarea rows={2} maxLength={180} value={brief.proof} onChange={e=>field("proof",e.target.value)} placeholder="Only include evidence you can actually support"/></label>
    <label>Call to action<input value={brief.cta} maxLength={80} onChange={e=>field("cta",e.target.value)} required/></label>
    <label>HTTPS destination<input type="url" value={brief.landingUrl} onChange={e=>field("landingUrl",e.target.value)} required/></label>
    {error&&<p className="studio-error" role="alert">{error}</p>}
    <button className="primary" type="submit">Generate 12 creative drafts</button>
    <p className="small">Generated locally in your browser. Nothing you enter is uploaded or saved by this planning tool.</p>
   </form>
   <div>
    <h2>2. Review the output</h2>
    {!kit?<div className="studio-empty">Fill out the brief and generate drafts. You'll see three distinct angles for each supported channel, plus a tracked link.</div>:
     <div aria-live="polite">
      <p><strong>{kit.variants.length} drafts prepared</strong> for the {kit.brand} campaign.</p>
      <label className="studio-filter">View drafts by platform
       <select value={platform} onChange={e=>setPlatform(e.target.value)}>
        {GROWTH_CHANNELS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
       </select>
      </label>
      <div className="studio-results">
       {visible.map(v=><article className="studio-variant" key={v.id}>
        <p className="kicker">{v.channel} · {v.angleName}</p>
        <h3>{v.hook}</h3>
        <p><strong>Creative direction:</strong> {v.shotList}</p>
        <label>Caption draft<textarea rows={7} readOnly value={v.caption}/></label>
        <button type="button" onClick={()=>copy(v.caption)}>Copy caption</button>
        <button type="button" onClick={()=>copy(v.trackingUrl)}>Copy campaign link</button>
        <p className="small">Draft only. Not posted, recorded, scheduled, sold or delivered.</p>
       </article>)}
      </div>
      <p role="status">{copyNotice}</p>
      <button type="button" onClick={exportKit}>Export all 12 drafts (JSON)</button>
     </div>}
   </div>
  </section>
  <section className="panel">
   <h2>3. Turn this into a billable client service</h2>
   <p>Litix can use these planning outputs for a <strong>manually reviewed content-operations proposal</strong>. Before accepting payment, confirm the video editor, authorized publishing channels, deliverables, production costs and an agreed client scope.</p>
   <div className="partner-actions">
    <a className="primary" href="/agency-growth?offer=marketing-ops#request">Request a content-operations proposal</a>
    <a href="/demo/lead-operations">See Litix's lead-response workflow</a>
   </div>
  </section>
  <section className="panel">
   <h2>What a $10,000/week gross revenue run rate requires</h2>
   <label className="studio-filter">Monthly retainer per paying client (USD)
    <input type="number" min="1" max="100000" step="100" value={retainer} onChange={e=>setRetainer(e.target.value)}/>
   </label>
   {forecast?<div className="studio-metrics">
    <div><strong>{forecast.clientsNeeded}</strong><span>Active paying clients needed</span></div>
    <div><strong>{forecast.monthlyGross.toLocaleString("en-US",{style:"currency",currency:"USD"})}</strong><span>Monthly contracted gross target</span></div>
    <div><strong>{forecast.weeklyGrossRunRate.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0})}</strong><span>Weekly gross run rate</span></div>
    <div><strong>{forecast.qualifiedSalesCalls}</strong><span>Qualified calls if 20% close</span></div>
   </div>:<p>Enter a valid positive monthly retainer.</p>}
   <p className="small">Planning estimates—not sales, booked clients or profit. The call requirement is a total pipeline estimate to reach the target, not a weekly quota. Customer costs, fulfillment staff, refunds, payment fees and churn reduce actual earnings.</p>
  </section>
 </div>;
}
