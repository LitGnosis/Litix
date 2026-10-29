"use client";
import {useCallback,useEffect,useState} from "react";
const fmt=x=>x==null?"—":typeof x==="number"?x.toLocaleString():String(x);
export default function OwnerBoosteroDashboard(){
 const [page,setPage]=useState(1),[data,setData]=useState(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  try{
   const response=await fetch("/api/owner/boostero?page="+page,{credentials:"same-origin",cache:"no-store"});
   if(!response.ok)throw Error("Owner operations data unavailable ("+response.status+")");
   setData(await response.json());setError("");
  }catch(e){setError(String(e.message||"Dashboard unavailable"))}
 },[page]);
 useEffect(()=>{load()},[load]);
 const manualSync=async()=>{
  if(busy)return;
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/internal/boostero/inventory-sync",{
    method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},
    body:"{}"
   });
   const info=await r.json();
   setNotice(info.skipped?"Synchronization held: "+info.skipped:
    info.ok?"Verified inventory synchronized. "+fmt(info.imported)+" records imported; new public activation remains separately gated.":
    "Synchronization not performed: "+String(info.error||"unavailable"));
   await load();
  }catch{setNotice("Synchronization unavailable. No customer payment or supplier order was attempted.")}
  finally{setBusy(false)}
 };
 const info=data?.inventory||{},approved=data?.approvedServiceCount||{},orders=data?.orderHealth||{};
 const cells=[
  ["Public approved",approved.enabled],["Imported",info.imported],["Verified metadata",info.verified],
  ["Eligible to activate",info.validated_purchasable],["Unsupported type",info.unsupported],
  ["Pending review",info.pending],["Invalid",info.invalid],["Paid awaiting",orders.paid_awaiting],
  ["Fulfillment processing",orders.processing],["Completed",orders.completed],
  ["Owner recovery",orders.recovery]
 ];
 return <main style={{maxWidth:1150,margin:"0 auto",padding:"32px 18px",color:"#eaf4ff"}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
   <div><p style={{color:"#9ecdeb",letterSpacing:3,fontSize:12}}>LITIX OWNER OPERATIONS</p>
    <h1 style={{fontSize:"clamp(26px,5vw,40px)",margin:"8px 0"}}>Boostero Control Center</h1>
    <p style={{color:"#b0c5d8"}}>Authenticated owner view. No wholesale prices, credentials or payment tokens are shown.</p></div>
   <button disabled={busy||!data?.release?.backupVerified||!data?.release?.syncEnabled}
     onClick={manualSync} style={{padding:"13px 20px",background:"#1b5c88",border:"1px solid #81c7f4",
      borderRadius:12,color:"#fff",fontWeight:700,cursor:"pointer"}}>
     {busy?"Synchronizing…":"Run verified catalog sync"}</button>
  </div>
  {data&&!data.release?.backupVerified&&<p role="status" style={{color:"#f4c87d"}}>Backup verification gate is closed. No catalog writes or public activation will run.</p>}
  {error&&<p role="alert" style={{color:"#ffa6a6"}}>{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {data?.unavailableSections?.length>0&&<p role="status">Some database sections are awaiting migration: {data.unavailableSections.join(", ")}.</p>}
  <section aria-label="Operations summary" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:12,marginTop:22}}>
   {cells.map(([label,value])=><article key={label} style={{background:"linear-gradient(145deg,#08213a,#143d60)",border:"1px solid #365d80",borderRadius:12,padding:16}}>
    <p style={{color:"#9fb8d1",fontSize:13}}>{label}</p><strong style={{fontSize:27}}>{fmt(value)}</strong>
   </article>)}
  </section>
  <section style={{background:"#0b2034",border:"1px solid #355576",padding:20,borderRadius:12,marginTop:24}}>
   <h2>Sync terminal</h2>
   <p style={{color:"#adbed0"}}>Latest 50 sanitized events · Page {page}. Every supplier sync is read-only until verification gates authorize an import.</p>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
    <thead><tr>{["Time","Event","Level","Received","Processed","Activated","Rejected","Deactivated","Duration","Error"].map(x=><th key={x} style={{padding:8,borderBottom:"1px solid #42627f"}}>{x}</th>)}</tr></thead>
    <tbody>{(data?.log?.events||[]).map(e=><tr key={e.event_id}>
     {[new Date(e.created_at).toLocaleString(),e.operation,e.event_level,e.supplier_total,
       e.processed,e.activated,e.rejected,e.deactivated,
       e.elapsed_ms==null?"—":e.elapsed_ms+" ms",e.error_code||"—"].map((x,i)=>
       <td key={i} style={{padding:8,borderBottom:"1px solid #1b3c53",whiteSpace:"nowrap",fontSize:13}}>{x}</td>)}
    </tr>)}</tbody>
   </table></div>
   {!data?.log?.events?.length&&<p>No synchronization events recorded yet.</p>}
   <div style={{display:"flex",gap:12,marginTop:16}}>
    <button disabled={page===1} onClick={()=>setPage(v=>Math.max(1,v-1))}>Previous 50</button>
    <button disabled={(data?.log?.events||[]).length<50} onClick={()=>setPage(v=>v+1)}>Next 50</button>
    <button onClick={load}>Refresh</button>
   </div>
  </section>
  <section style={{marginTop:20,color:"#b0c5d8"}}>
   <p>Routine log retention preview: {fmt(data?.retentionPreview?.candidates)} entries potentially eligible after {fmt(data?.retentionPreview?.days)} days.
   Automatic deletion is disabled pending incident and backup review.</p>
   <p>Release: backup {data?.release?.backupVerified?"verified":"unverified"} · sync {data?.release?.syncEnabled?"enabled":"disabled"} · typed purchasing {data?.release?.typedPurchasingEnabled?"enabled":"disabled"}.</p>
   <a href="/owner/wholesale/logout" style={{color:"#a4dbff"}}>Sign out</a>
  </section>
 </main>;
}
