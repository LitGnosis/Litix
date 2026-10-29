"use client";
import {useState} from "react";
const typeName=x=>String(x||"Default").toLowerCase().trim();
const numeric=(name,label,value,onChange,options={})=><label key={name} className="lgc-form-field">{label}<input type="number" name={name} min={options.min??0} max={options.max??1000000} required={options.required!==false} step="1" value={value??""} onChange={e=>onChange(name,e.target.value)}/></label>;
const inputField=(name,label,value,onChange,placeholder="")=><label key={name} className="lgc-form-field">{label}<input type="text" name={name} value={value??""} maxLength={500} placeholder={placeholder} onChange={e=>onChange(name,e.target.value)}/></label>;
export default function GlobalServiceDraft({service,onClose}){
 const [data,setData]=useState({quantity:service.supplierMinimum||1,min:service.supplierMinimum||1,max:service.supplierMaximum||1000,
   posts:5,delay:60,runs:2,interval:30,answer_number:1});
 const [message,setMessage]=useState("");
 const type=typeName(service.type);
 const isSub=type==="subscriptions";
 const isPackage=type==="package";
 const isComments=type==="custom comments";
 const isMentionsList=type==="mentions custom list";
 const hasQty=!isSub&&!isPackage&&!isComments;
 const set=(name,value)=>{setData(d=>({...d,[name]:value}));setMessage("")};
 const submit=e=>{
  e.preventDefault();
  const n=Number(data.quantity);
  if(hasQty&&(!Number.isSafeInteger(n)||n<Number(service.supplierMinimum)||n>Number(service.supplierMaximum))){
   setMessage("Quantity must remain within the verified supplier limits.");return;
  }
  if(isComments&&(!String(data.comments||"").trim()||String(data.comments).split(/\r?\n/).filter(Boolean).length<service.supplierMinimum)){
   setMessage("Enter at least the supplier minimum number of comments.");return;
  }
  if(isSub&&(!String(data.username||"").trim()||!Number.isSafeInteger(Number(data.posts))||Number(data.posts)<1)){
   setMessage("Enter a username and a bounded number of future posts.");return;
  }
  setMessage("Draft recorded only in this browser. This service is not approved for checkout or supplier submission yet.");
 };
 return <div className="lgc-modal-overlay" role="dialog" aria-modal="true" aria-label="Supplier service requirements" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="lgc-modal"><button type="button" className="lgc-modal-close" onClick={onClose} aria-label="Close service requirements">×</button>
   <span className="lgc-eyebrow">BOOSTERO · SERVICE REQUIREMENTS</span><h2>{service.name}</h2>
   <p className="lgc-muted">Platform: {service.platform} · Order type: {service.type}</p>
   <div className="lgc-warning">Configuration preview only. No card will be charged, no purchase will be submitted, and no subscription will be activated.</div>
   <form onSubmit={submit} className="lgc-form">
    {isSub?<>
      {inputField("username","Social profile username",data.username,set,"@username")}
      {numeric("min","Minimum units per post",data.min,set,{min:service.supplierMinimum,max:service.supplierMaximum})}
      {numeric("max","Maximum units per post",data.max,set,{min:service.supplierMinimum,max:service.supplierMaximum})}
      {numeric("posts","Number of future posts to cover",data.posts,set,{min:1,max:10000})}
      {numeric("old_posts","Existing posts (where supported)",data.old_posts,set,{min:0,max:10000,required:false})}
      <label className="lgc-form-field">Delivery delay<select value={data.delay} onChange={e=>set("delay",e.target.value)}>
        {[0,5,10,15,20,30,40,50,60,90,120,150,180,210,240,270,300,360,420,480,540,600].map(n=><option value={n} key={n}>{n} minutes</option>)}</select></label>
      <label className="lgc-form-field">End date (optional)<input type="date" value={data.expiry||""} onChange={e=>set("expiry",e.target.value)}/></label>
      <p className="lgc-muted">Boostero bills subscriptions as future posts are processed. Litix will not activate subscriptions until usage limits, recurring billing, cancellation and owner alerts have been verified.</p>
     </>:<>
      {inputField("link","Public target/profile/post link",data.link,set,"https://…")}
      {hasQty?numeric("quantity","Quantity",data.quantity,set,{min:service.supplierMinimum,max:service.supplierMaximum}):null}
      {isPackage?<p className="lgc-muted">Packages use a fixed supplier-price contract without a numeric quantity. Pricing must be verified before activation.</p>:null}
      {isComments?<label className="lgc-form-field">Custom comments (one per line)<textarea rows={5} value={data.comments||""} onChange={e=>set("comments",e.target.value)}/></label>:null}
      {isMentionsList?<label className="lgc-form-field">Usernames to mention (one per line)<textarea rows={4} value={data.usernames||""} onChange={e=>set("usernames",e.target.value)}/></label>:null}
      {type==="mentions hashtag"?inputField("hashtag","Hashtag",data.hashtag,set,"#campaign"):null}
      {["mentions user followers","comment likes"].includes(type)?inputField("username","Source/comment username",data.username,set,"@username"):null}
      {type==="poll"?numeric("answer_number","Poll answer number",data.answer_number,set,{min:1,max:100}):null}
      {service.dripfeed&&type==="default"?<>
       <label className="lgc-form-checkbox"><input type="checkbox" checked={!!data.dripfeedEnabled} onChange={e=>set("dripfeedEnabled",e.target.checked)}/> Split delivery into timed runs</label>
       {data.dripfeedEnabled?<>{numeric("runs","Number of runs",data.runs,set,{min:2,max:100})}{numeric("interval","Minutes between runs",data.interval,set,{min:1,max:10080})}
        <p className="lgc-muted">Total units: {Number(data.quantity||0)*Number(data.runs||0)}. Boostero charges for every run, not just one.</p></>:null}
      </>:null}
      {["Instagram","TikTok"].includes(service.platform)&&!isPackage&&<label className="lgc-form-field">Additional post URLs for a future multi-post order (one per line; not yet supported for purchase)
       <textarea rows={3} value={data.additionalPostUrls||""} onChange={e=>set("additionalPostUrls",e.target.value)}/></label>}
     </>}
    <button type="submit" className="lgc-modal-submit">Validate draft — no purchase</button>
   </form>
   {message&&<div className="lgc-form-notice" role="status">{message}</div>}
  </section>
 </div>;
}
