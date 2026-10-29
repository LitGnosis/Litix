"use client";
import {useState} from "react";
import {orderFormSchema,validateServiceDraft} from "../../lib/boosteroOrderForms.mjs";
export default function ServiceDraft({service,onClose}){
 const schema=orderFormSchema(service),[draft,setDraft]=useState({quantity:service.min||1}),[result,setResult]=useState(null);
 const label={profile:"Public profile or @username",postUrl:"Public post URL",quantity:"Quantity",
  additionalPostUrls:"Additional post URLs (one per line)",comments:"Custom comments (one per line)",
  runs:"Drip-feed runs",posts:"Number of new posts",intervalMinutes:"Interval (minutes)"};
 const submit=e=>{e.preventDefault();setResult(validateServiceDraft(service,draft))};
 return <div role="dialog" aria-modal="true" aria-label="Service input preview" style={{position:"fixed",inset:0,zIndex:100,background:"#020714ed",overflowY:"auto",padding:20}}>
   <div style={{maxWidth:600,margin:"30px auto",padding:24,borderRadius:18,background:"linear-gradient(135deg,#123462,#071526)",border:"1px solid #6395cf",color:"#eaf4ff"}}>
    <button type="button" onClick={onClose} style={{float:"right",background:"#16395e",color:"white",padding:"8px 16px",border:"1px solid #629ddf",borderRadius:9}}>Close</button>
    <h2 style={{marginBottom:10}}>Preview order requirements</h2>
    <p>{service.name}</p>
    <p style={{color:"#ffd99c"}}>Not purchasable. This preview cannot process PayKings payments or submit Boostero orders.</p>
    {schema.canConfigure?<form onSubmit={submit}>
      {schema.fields.map(x=><label key={x.name} style={{display:"block",margin:"15px 0",fontSize:14}}>
       {label[x.name]||x.name}
       {x.kind==="multiline"?<textarea rows={4} value={draft[x.name]||""} onChange={e=>setDraft(v=>({...v,[x.name]:e.target.value}))}
        style={{display:"block",marginTop:6,width:"100%",padding:12,background:"#081629",color:"white",border:"1px solid #6395cf",borderRadius:8}}/>:
       <input type={x.kind==="number"?"number":"text"} value={draft[x.name]??""} min={x.min} max={x.max}
        onChange={e=>setDraft(v=>({...v,[x.name]:e.target.value}))} required={x.required}
        style={{display:"block",marginTop:6,width:"100%",padding:12,background:"#081629",color:"white",border:"1px solid #6395cf",borderRadius:8}}/>}
      </label>)}
      <button type="submit" style={{background:"#1a6cba",border:"1px solid #77caff",padding:"12px 18px",color:"white",borderRadius:9}}>Validate draft — no charge</button>
     </form>:<p>Additional API-specific inputs and fulfillment support are required for this service.</p>}
    {result?<p role="status" style={{padding:15,background:"#102744",borderRadius:8,marginTop:14}}>
      {result.ok?"Draft fields are valid. Purchase remains disabled until owner approval.":"Please correct: "+Object.entries(result.errors).map(([k,v])=>k+": "+v).join("; ")}
     </p>:null}
   </div>
  </div>
}
