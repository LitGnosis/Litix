"use client";
import {useState} from "react";

const captionInitial={business:"",audience:"",offer:"",action:"",platform:"Instagram"};
const linkInitial={name:"",tagline:"",links:[{label:"",url:""},{label:"",url:""}]};
const campaignInitial={...captionInitial,website:""};
const serviceChoices=[
 {id:"litix-native-caption-kit",title:"Caption Starter Kit",details:"Six editable original caption drafts, generated from your business brief."},
 {id:"litix-native-link-page",title:"Creator Link Page",details:"A downloadable personal link-page HTML file, ready to host on your own website."},
 {id:"litix-native-campaign-plan",title:"7-Day Campaign Planner",details:"Seven original campaign prompts with captions, production guidance and optional tagged links. Download as a CSV."}
];
export default function LitixNativeStudio(){
 const [serviceId,setServiceId]=useState(serviceChoices[0].id);
 const [caption,setCaption]=useState(captionInitial);
 const [links,setLinks]=useState(linkInitial);
 const [campaign,setCampaign]=useState(campaignInitial);
 const [status,setStatus]=useState("idle");
 const [message,setMessage]=useState("");
 const [asset,setAsset]=useState(null);
 const captionField=(name,value)=>{setCaption(old=>({...old,[name]:value}));setAsset(null);};
 const campaignField=(name,value)=>{setCampaign(old=>({...old,[name]:value}));setAsset(null);};
 const current=serviceId==="litix-native-campaign-plan"?campaign:caption;
 const currentField=serviceId==="litix-native-campaign-plan"?campaignField:captionField;
 const linkField=(name,value)=>{setLinks(old=>({...old,[name]:value}));setAsset(null);};
 const rowField=(i,name,value)=>{setLinks(old=>({...old,links:old.links.map((p,index)=>index===i?{...p,[name]:value}:p)}));setAsset(null);};
 const changeService=id=>{setServiceId(id);setAsset(null);setMessage("");setStatus("idle");};
 async function generate(event){
  event.preventDefault();
  if(status==="working")return;
  setStatus("working");setMessage("");setAsset(null);
  try{
   const brief=serviceId==="litix-native-caption-kit"?caption:serviceId==="litix-native-campaign-plan"?campaign:links;
   const response=await fetch("/api/native/v1/preview",{
    method:"POST",headers:{"content-type":"application/json"},cache:"no-store",
    body:JSON.stringify({serviceId,brief})
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||payload.deliveryState!=="PREVIEW_ONLY_NOT_PURCHASED")throw Error("Check your inputs and try again.");
   if(!["text/plain; charset=utf-8","text/html; charset=utf-8","text/csv; charset=utf-8"].includes(payload.mimeType)||
      typeof payload.content!=="string"||typeof payload.filename!=="string"||
      payload.content.length>25000)throw Error("The file could not be verified.");
   setAsset(payload);setStatus("ready");
   setMessage("Your original asset is ready. No payment or supplier order was created.");
  }catch(err){setStatus("error");setMessage(err.message||"Unable to generate your file.");}
 }
 function download(){
  if(!asset)return;
  const blob=new Blob([asset.content],{type:asset.mimeType});
  const href=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=href;a.download=asset.filename;
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(href),2000);
 }
 return <section className="ls-panel ls-tool-panel" aria-label="Litix Native self-service studio">
  <h2>Choose an original Litix digital service</h2>
  <p>Generate a file yourself. No social password, account connection, checkout or outside supplier required.</p>
  <div className="ls-tool-fields">
   <label>Type of service
    <select value={serviceId} onChange={e=>changeService(e.target.value)}>
     {serviceChoices.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}
    </select>
   </label>
  </div>
  <p className="ls-note">{serviceChoices.find(x=>x.id===serviceId)?.details}</p>
  <form onSubmit={generate}>
   <div className="ls-tool-fields">
    {serviceId!=="litix-native-link-page"?<>
     <label>Business or creator name<input required minLength={2} maxLength={80} value={current.business} onChange={e=>currentField("business",e.target.value)} /></label>
     <label>Audience<input required minLength={2} maxLength={110} value={current.audience} onChange={e=>currentField("audience",e.target.value)} /></label>
     <label>Offer or message<textarea rows={3} required minLength={4} maxLength={170} value={current.offer} onChange={e=>currentField("offer",e.target.value)} /></label>
     <label>Call to action<input required minLength={3} maxLength={110} value={current.action} onChange={e=>currentField("action",e.target.value)} /></label>
     <label>Social network
      <select value={current.platform} onChange={e=>currentField("platform",e.target.value)}>
       {["Instagram","TikTok","YouTube","Facebook","LinkedIn","X"].map(x=><option key={x}>{x}</option>)}
      </select>
     </label>
     {serviceId==="litix-native-campaign-plan"&&<label>Landing page (optional HTTPS URL)<input type="url" maxLength={300} placeholder="https://your-site.com" value={campaign.website} onChange={e=>campaignField("website",e.target.value)} /></label>}
    </>:<>
     <label>Creator / business name<input required minLength={2} maxLength={80} value={links.name} onChange={e=>linkField("name",e.target.value)} /></label>
     <label>Tagline<input maxLength={160} value={links.tagline} onChange={e=>linkField("tagline",e.target.value)} /></label>
     {links.links.map((entry,i)=><div key={i}>
      <label>Link {i+1} label<input maxLength={70} value={entry.label} onChange={e=>rowField(i,"label",e.target.value)} /></label>
      <label>Link {i+1} URL<input type="url" maxLength={350} placeholder="https://example.com" value={entry.url} onChange={e=>rowField(i,"url",e.target.value)} /></label>
     </div>)}
    </>}
   </div>
   <button className="ls-cta" type="submit" disabled={status==="working"} style={{marginTop:18}}>
    {status==="working"?"Generating original file…":"Generate free file"}
   </button>
  </form>
  <p role="status" aria-live="polite" className="ls-note">{message}</p>
  {asset&&<div className="ls-tool-result">
   <h3>Ready: {asset.filename}</h3>
   <p>Preview only · No order placed · No payment charged</p>
   <button type="button" onClick={download}>Download your file</button>
   <details><summary>Inspect generated file</summary>
    <textarea readOnly rows={10} value={asset.content} aria-label="Generated file content" style={{width:"100%",fontFamily:"monospace"}}/>
   </details>
  </div>}
  <p className="ls-note">Outputs are draft assets for your review. This is a free trial of Litix-owned delivery, not an artificial likes/followers service, and not a paid subscription.</p>
 </section>;
}
