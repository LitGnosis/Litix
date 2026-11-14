"use client";
import {useCallback,useEffect,useState} from "react";
import {useParams} from "next/navigation";

const STAGES=["Payment Verified","Order Dispatched","Delivering","Completed"];
const fmt=value=>Number(value).toLocaleString("en-US");

export default function PrivateLitixTracker(){
 const {token}=useParams();
 const [record,setRecord]=useState(null);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [refillBusy,setRefillBusy]=useState(false);
 const query=useCallback(async()=>{
  if(typeof token!=="string")return;
  setBusy(true);
  try{
   const r=await fetch("/api/orders/track?token="+encodeURIComponent(token),{
    cache:"no-store",credentials:"same-origin"
   });
   const data=await r.json();
   if(!r.ok)throw Error(data.error||"Tracking is temporarily unavailable");
   setRecord(data.order);setMessage("");
  }catch(e){setMessage(e.message||"Tracking is temporarily unavailable");}
  finally{setBusy(false);}
 },[token]);
 useEffect(()=>{
  document.title="Private order tracking | Litix";
  void query();
  const interval=setInterval(()=>{
   if(document.visibilityState==="visible")void query();
  },120000);
  return()=>clearInterval(interval);
 },[query]);
 const requestRefill=async()=>{
  if(refillBusy||!record?.refillEligible)return;
  setRefillBusy(true);
  try{
   const r=await fetch("/api/orders/refill",{
    method:"POST",headers:{"content-type":"application/json"},
    credentials:"same-origin",body:JSON.stringify({token})
   });
   const data=await r.json();
   if(!r.ok)throw Error(data.error||"Refill requests are currently unavailable");
   await query();
   setMessage(data.message||"Your refill request was recorded.");
  }catch(e){setMessage(e.message||"Contact Litix support for refill assistance.");}
  finally{setRefillBusy(false);}
 };
 const panel={padding:"clamp(16px,4vw,28px)",background:"#0e263d",border:"1px solid #7db9df70",borderRadius:18};
 const action={minHeight:44,borderRadius:12,padding:"10px 17px",fontWeight:800,border:0,background:"#88d0fc",color:"#061c30",cursor:"pointer"};
 return <main style={{minHeight:"100dvh",background:"linear-gradient(155deg,#061426,#0b2f47)",color:"#e7f6ff",
  fontFamily:"system-ui,sans-serif",padding:"clamp(20px,5vw,50px)",overflowWrap:"anywhere"}}>
  <div style={{maxWidth:760,margin:"0 auto"}}>
   <nav style={{marginBottom:28}}><a href="/" style={{color:"#9fe0ff",fontWeight:800}}>LITIX · Home</a></nav>
   <h1 style={{fontSize:"clamp(28px,5vw,43px)",marginBottom:8}}>Private order tracking</h1>
   <p style={{color:"#b1cde3",marginBottom:24}}>View your latest recorded payment and delivery updates. No social password needed.</p>
   {message&&<p role="status" style={{...panel,marginBottom:16}}>{message}</p>}
   {!record&&<div style={panel}><p>{busy?"Retrieving your Litix order…":"Your private order details are unavailable. If the link is incomplete, use the email lookup on the order center."}</p>
     <a href="/track" style={{color:"#a5ddff"}}>Open the secure order center</a>
    </div>}
   {record&&<section style={{...panel,display:"grid",gap:18}}>
    <div><small style={{color:"#a6cee4"}}>LITIX ORDER</small>
     <div style={{fontWeight:800}}>{record.id}</div></div>
    <h2 style={{fontSize:22,margin:0}}>{record.service}</h2>
    <ol aria-label="Order progress" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,listStyle:"none",margin:0,padding:0}}>
     {STAGES.map((label,i)=><li key={label} style={{background:i<record.progressStep?"#15546d":"#162d40",
      border:"1px solid "+(i<record.progressStep?"#8edcff":"#335a75"),padding:12,borderRadius:11,fontSize:13,fontWeight:700}}>
      <span aria-hidden="true">{i<record.progressStep?"✓ ":"○ "}</span>{label}
     </li>)}
    </ol>
    <dl style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14,margin:0}}>
     {[
      ["Payment","Verified"],["Quantity",fmt(record.quantity)],["Total paid","USD $"+record.totalUSD],
      ["Latest status",record.status],["Start count",record.startCount===null?"Not reported":fmt(record.startCount)],
      ["Remaining",record.remains===null?"Not reported":fmt(record.remains)]
     ].map(([name,value])=><div key={name} style={{minWidth:0}}>
      <dt style={{fontSize:12,color:"#9fbed0"}}>{name}</dt>
      <dd style={{fontSize:15,fontWeight:750,margin:0,overflowWrap:"anywhere"}}>{value}</dd>
     </div>)}
    </dl>
    {record.reviewRequired&&<p role="status" style={{color:"#ffd49e"}}>This order needs a delivery review. Please do not purchase the same service again.</p>}
    {record.checkedAt&&<small style={{color:"#9bbbd0"}}>Supplier status checked {new Date(record.checkedAt).toLocaleString()}</small>}
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
     <button type="button" disabled={busy} onClick={query} style={action}>{busy?"Checking…":"Refresh status"}</button>
     {record.refillEligible&&<button type="button" disabled={refillBusy} onClick={requestRefill} style={action}>
      {refillBusy?"Requesting…":"Request Refill"}</button>}
     <a style={{...action,background:"#164966",color:"#eaf7ff",textDecoration:"none",display:"inline-flex",alignItems:"center"}}
      href="/track">Order lookup</a>
    </div>
    <small style={{color:"#a0c6dc"}}>A verified payment and a completed delivery are separate milestones. Refill availability is checked against the live supplier service.</small>
   </section>}
  </div>
 </main>;
}
