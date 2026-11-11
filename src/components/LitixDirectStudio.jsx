"use client";
import { useMemo, useState } from "react";

const channels = [
 {id:"instagram",label:"Instagram"},
 {id:"tiktok",label:"TikTok"},
 {id:"youtube",label:"YouTube"},
 {id:"linkedin",label:"LinkedIn"}
];
const startingBrief = {
 brand:"Litix",campaign:"first-party-growth",audience:"small business owners and independent creators",
 pain:"inconsistent publishing and unclear campaign results",
 solution:"a structured content plan with original captions and trackable URLs",
 proof:"",cta:"Visit our site",landingUrl:"https://www.litix.net/agency-growth"
};
const humanError = code => ({
 invalid_campaign_brief:"Complete the campaign details and include an HTTPS destination URL.",
 brief_too_large:"This campaign brief is too large. Shorten your entries.",
 invalid_brief_json:"The request could not be read. Check your input and try again.",
 json_required:"The browser sent an unsupported format."
}[code] || "The creative service is currently unavailable. Please try again.");

export default function LitixDirectStudio() {
 const [brief,setBrief] = useState(startingBrief);
 const [kit,setKit] = useState(null);
 const [channel,setChannel] = useState("instagram");
 const [loading,setLoading] = useState(false);
 const [notice,setNotice] = useState("");
 const [error,setError] = useState("");
 const visible = useMemo(() => kit?.variants?.filter(v=>v.platform===channel) || [],[kit,channel]);
 function field(name,value) {setBrief(prev=>({...prev,[name]:value}));setError("");}
 async function fulfill(event) {
  event.preventDefault();
  if(loading)return;
  setLoading(true);setKit(null);setNotice("");setError("");
  try{
   const response = await fetch("/api/direct-smm/creative-kit",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(brief),cache:"no-store",signal:AbortSignal.timeout(20000)
   });
   const result = await response.json();
   if(!response.ok)throw new Error(humanError(result.error));
   if(result.service!=="litix_first_party_growth_kit"||result.status!=="generated_draft"||
      result.chargeAttempted!==false||result.supplierApiCalled!==false||
      !Array.isArray(result.kit?.variants)||result.kit.variants.length!==12)
     throw new Error("Litix did not return a complete verified creative kit.");
   setKit(result.kit);
   setNotice("Twelve creative drafts delivered. Review, copy or export your work below.");
  }catch(err){setError(err?.name==="TimeoutError"?"The service timed out. No payment was attempted.":String(err?.message||"Creative delivery failed."));}
  finally{setLoading(false)}
 }
 async function copy(value){
  try{await navigator.clipboard.writeText(value);setNotice("Copied.")}
  catch{setNotice("Clipboard access is unavailable. Select and copy the text manually.")}
 }
 function download(){
  if(!kit)return;
  const file = new Blob([JSON.stringify(kit,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(file);
  const a=document.createElement("a");a.href=url;a.download="litix-direct-"+kit.campaign+"-creative-kit.json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  setNotice("Export prepared. Your original editable drafts are in the downloaded JSON file.");
 }
 return <section className="litix-direct-workspace" aria-label="Instant marketing creative fulfillment">
  <form className="litix-direct-form" onSubmit={fulfill}>
   <p className="litix-direct-eyebrow">01 / SUBMIT YOUR BRIEF</p>
   <h2>Your campaign</h2>
   <p>Everything below is used to produce your downloadable deliverable. Do not enter passwords or payment information.</p>
   <label>Brand or business<input required maxLength={70} value={brief.brand} onChange={e=>field("brand",e.target.value)}/></label>
   <label>Campaign name<input required maxLength={80} value={brief.campaign} onChange={e=>field("campaign",e.target.value)}/></label>
   <label>Target audience<input required maxLength={120} value={brief.audience} onChange={e=>field("audience",e.target.value)}/></label>
   <label>Customer problem<textarea rows={2} required maxLength={140} value={brief.pain} onChange={e=>field("pain",e.target.value)}/></label>
   <label>Your offer or solution<textarea rows={2} required maxLength={180} value={brief.solution} onChange={e=>field("solution",e.target.value)}/></label>
   <label>Verified proof (optional)<textarea rows={2} maxLength={180} value={brief.proof} onChange={e=>field("proof",e.target.value)} placeholder="Only facts you can substantiate"/></label>
   <label>Call to action<input required maxLength={80} value={brief.cta} onChange={e=>field("cta",e.target.value)}/></label>
   <label>HTTPS landing page<input required type="url" maxLength={500} value={brief.landingUrl} onChange={e=>field("landingUrl",e.target.value)}/></label>
   <button type="submit" className="litix-direct-primary" disabled={loading}>{loading?"Generating your deliverable…":"Fulfill my creative kit · Free"}</button>
   <p className="litix-direct-note">Litix processes this brief to return drafts. No order is charged, no supplier is contacted and no social post is published.</p>
  </form>
  <div className="litix-direct-result" aria-live="polite">
   <p className="litix-direct-eyebrow">02 / YOUR DELIVERABLE</p>
   <h2>Creative delivery</h2>
   {!kit?<div className="litix-direct-empty">
    <strong>Ready for your campaign.</strong>
    <p>Submit your brief to generate original content for Instagram, TikTok, YouTube Shorts and LinkedIn directly through Litix.</p>
   </div>:<>
    <div className="litix-direct-delivered"><strong>12 drafts generated</strong><span>Delivered instantly · No supplier involved</span></div>
    <div className="litix-direct-filters" role="group" aria-label="Filter creative drafts by channel">
     {channels.map(c=><button key={c.id} type="button" aria-pressed={channel===c.id} className={channel===c.id?"litix-direct-selected":""} onClick={()=>setChannel(c.id)}>{c.label}</button>)}
    </div>
    {visible.map(v=><article key={v.id} className="litix-direct-draft">
     <p className="litix-direct-eyebrow">{v.channel} · {v.angleName}</p>
     <h3>{v.hook}</h3>
     <p><strong>Video direction:</strong> {v.shotList}</p>
     <label>Editable caption<textarea readOnly rows={6} value={v.caption}/></label>
     <div className="litix-direct-actions">
      <button type="button" onClick={()=>copy(v.caption)}>Copy caption</button>
      <button type="button" onClick={()=>copy(v.trackingUrl)}>Copy tracking link</button>
     </div>
    </article>)}
    <button type="button" className="litix-direct-primary" onClick={download}>Download all 12 drafts</button>
    <p className="litix-direct-note">Drafts require review. Copying or downloading does not publish posts, buy engagement or submit an order.</p>
   </>}
   {notice&&<p role="status" className="litix-direct-notice">{notice}</p>}
   {error&&<p role="alert" className="litix-direct-error">{error}</p>}
  </div>
 </section>;
}
