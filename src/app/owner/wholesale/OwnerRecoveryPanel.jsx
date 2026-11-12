"use client";
import {useState} from "react";
const field={width:"100%",boxSizing:"border-box",padding:"11px 12px",fontSize:16,
 color:"#eef7ff",background:"#0c2848",border:"1px solid #507eab",borderRadius:10};
const button={background:"#195a90",color:"#fff",border:"1px solid #82b6ed",borderRadius:10,
 padding:"10px 15px",fontWeight:700,cursor:"pointer"};
const request=async(path,options={})=>{
 const r=await fetch(path,{cache:"no-store",credentials:"same-origin",...options});
 const b=await r.json().catch(()=>({error:"Unrecognized response"}));
 if(!r.ok)throw Error(b?.error||"Order lookup failed");
 return b;
};
export default function OwnerRecoveryPanel({onReplacement}){
 const [id,setId]=useState(""),[order,setOrder]=useState(null);
 const [busy,setBusy]=useState(false),[refillBusy,setRefillBusy]=useState(false);
 const [error,setError]=useState(""),[outcome,setOutcome]=useState(null),[confirm,setConfirm]=useState(false);
 const review=async()=>{
  setBusy(true);setError("");setOrder(null);setOutcome(null);setConfirm(false);
  try{
   const d=await request("/api/owner/wholesale?view=order&id="+encodeURIComponent(id.trim()));
   setOrder(d.order);
  }catch(e){setError(String(e.message||e))}finally{setBusy(false)}
 };
 const refill=async()=>{
  if(!confirm||!order?.id||refillBusy)return;
  setRefillBusy(true);setError("");
  try{
   const b=await request("/api/owner/wholesale",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"refill",orderId:order.id,confirmed:true})
   });
   setOutcome(b);setConfirm(false);
  }catch(e){
   setError(String(e.message||e)+". Check the supplier and the recorded order before any further action.");
   setOutcome({requiresReview:true});
  }finally{setRefillBusy(false)}
 };
 const eligibleRefill=order?.supplier_order_id&&
  ["SUBMITTED","COMPLETED"].includes(order?.delivery_state)&&
  ["paid","admin_authorized"].includes(order?.payment_state);
 return <section style={{border:"1px solid #365f87",background:"#091d35",borderRadius:18,padding:22}}>
  <h2 style={{marginTop:0}}>Order recovery, refills and replacements</h2>
  <p style={{color:"#b4cbe2",lineHeight:1.5,fontSize:14}}>
   Check any Litix order before requesting a refill or paying for a replacement.
   Reconciliation comes first: a slow, unknown, or manually reviewed supplier order must never be duplicated automatically.
  </p>
  <label style={{display:"grid",gap:7}}>Existing Litix order ID
   <input style={field} value={id} onChange={e=>{setId(e.target.value);setOrder(null);setOutcome(null)}}
    placeholder="ltx2_..." spellCheck={false}/></label>
  <button type="button" style={{...button,marginTop:12}} disabled={busy||!/^ltx2_[0-9a-f-]{36}$/.test(id)}
   onClick={review}>{busy?"Checking…":"Check order and supplier status"}</button>
  {order&&<div style={{marginTop:16,padding:15,background:"#143352",borderRadius:11,display:"grid",gap:8}}>
   <strong>{order.service_name}</strong>
   <span>Payment: {order.payment_state} · Delivery: {order.delivery_state}</span>
   <span>Quantity: {Number(order.quantity).toLocaleString()} · Supplier order: {order.supplier_order_id||"none recorded"}</span>
   {order.error_code&&<span>Issue: {order.error_code}</span>}
   {order.advice&&<p style={{color:"#b4cbe2",margin:0,fontSize:14}}>{order.advice}</p>}
   {eligibleRefill&&outcome===null&&<>
    <label style={{display:"flex",gap:10,alignItems:"center",marginTop:10}}>
     <input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>
     I authorize one supplier refill request for this specific order.
    </label>
    <button type="button" style={button} disabled={!confirm||refillBusy}
     onClick={refill}>{refillBusy?"Checking supplier…":"Request eligible Boostero refill once (no PayKings charge)"}</button>
   </>}
   {order.replacementEligible&&<button type="button" style={{...button,background:"#28644c"}}
    onClick={()=>onReplacement?.(order)}>
    Prepare new owner-funded replacement purchase
   </button>}
   {!order.replacementEligible&&<small style={{color:"#e2c18b"}}>
    Replacement checkout is blocked until the original order is confirmed failed and no supplier order ID exists.
   </small>}
  </div>}
  {outcome&&<p role="status" style={{color:"#c4e5ff"}}>
   {outcome.refillRequested?"Supplier refill request was accepted.":
    "Refill outcome requires review. Do not repeat this request automatically."}
   No new card payment was submitted.
  </p>}
  {error&&<p role="alert" style={{color:"#ffc1c7"}}>{error}</p>}
 </section>;
}
