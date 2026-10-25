"use client";
import { useEffect, useState } from "react";
import AutoLikesDrafts from "./AutoLikesDrafts.jsx";
export default function AccountClient({user}){
  const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [billing,setBilling]=useState(null),[billingError,setBillingError]=useState("");
  const [cancelling,setCancelling]=useState(""),[billingNotice,setBillingNotice]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/account/dashboard",{cache:"no-store",signal:controller.signal})
      .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Dashboard unavailable");return v})
      .then(v=>setData(v)).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    fetch("/api/account/billing",{cache:"no-store",signal:controller.signal})
      .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Billing history unavailable");return v})
      .then(v=>setBilling(v)).catch(e=>{if(!controller.signal.aborted)setBillingError(e.message)});
    return()=>controller.abort();
  },[]);
  const cancelSubscription=async s=>{
    if(cancelling||!window.confirm("Cancel this monthly AutoLikes subscription? PayKings will stop future renewals after it confirms cancellation."))return;
    setCancelling(s.id);setBillingError("");setBillingNotice("");
    try{
      const r=await fetch("/api/account/billing",{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({action:"cancel",subscriptionId:s.id})});
      const d=await r.json();
      if(!r.ok)throw Error(d.error||"Cancellation not yet confirmed");
      setBillingNotice(d.message||"Cancellation requires review.");
      if(d.status==="cancelled")setBilling(old=>({...old,subscriptions:old.subscriptions.map(x=>x.id===s.id?{...x,status:"CANCELLED"}:x)}));
    }catch(e){setBillingError(String(e.message||"Cancellation request failed."))}
    finally{setCancelling("")}
  };
  const panel={border:"1px solid #325977",borderRadius:18,padding:22,background:"#122943"};
  return <main style={{minHeight:"100vh",padding:"24px 16px 70px",color:"#edf5ff",background:"linear-gradient(145deg,#071020,#0a2234)",fontFamily:"system-ui"}}>
    <div style={{maxWidth:850,margin:"0 auto",display:"grid",gap:18}}>
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><a style={{color:"#a9e3ff"}} href="/">Litix Home</a><a style={{color:"#a9e3ff"}} href="/auth/logout">Log out</a></nav>
      <div style={panel}><div style={{color:"#84cefb",letterSpacing:2,fontSize:13}}>LITIX CUSTOMER CENTER</div><h1>Welcome, {user.name}</h1><p style={{color:"#c0d6e5"}}>{user.email}</p></div>
      {loading&&<p role="status">Loading your orders and campaigns…</p>}
      {error&&<p role="alert">{error}</p>}
      {data&&<>
        <section style={panel}><h2>Your orders</h2>{data.orders.length===0?<p>No linked orders yet. Guest orders paid using your verified email will appear here.</p>:data.orders.map(o=><article key={o.id} style={{borderTop:"1px solid #2d5875",padding:"13px 0"}}>
          <strong style={{overflowWrap:"anywhere"}}>{o.id}</strong><p>{o.service} · {o.quantity} units · {o.amount}</p><p>Payment: {o.payment} · Supplier: {o.fulfillment}</p><a style={{color:"#8edfff"}} href={"/track?order="+encodeURIComponent(o.id)}>Track this order</a>
        </article>)}</section>
        <section style={panel}><h2>Billing and subscriptions</h2>
          <p style={{color:"#bcd3e5"}}>{billing?.recurring?.enabled?"Manage your current monthly subscriptions here. Charges renew according to the displayed plan until canceled.":"Saved campaign drafts never charge your card. Live recurring subscription purchases are not yet enabled."}</p>
          {billingNotice&&<p role="status" style={{color:"#a6f6cf"}}>{billingNotice}</p>}
          {billingError&&<p style={{color:"#fac2c2"}} role="status">{billingError}</p>}
          {billing?.subscriptions?.length?billing.subscriptions.map(s=><article key={s.id} style={{borderTop:"1px solid #2d5875",padding:"13px 0"}}>
            <strong style={{overflowWrap:"anywhere"}}>Campaign: {s.campaignId||"Legacy subscription"}</strong>
            <p>Status: {s.status} · {s.currentPeriodEnd?"Current period ends: "+new Date(s.currentPeriodEnd).toLocaleDateString():"No renewal date confirmed"}</p>
            {billing?.recurring?.enabled&&!["CANCELLED","EXPIRED"].includes(s.status)?<button type="button" disabled={Boolean(cancelling)} onClick={()=>cancelSubscription(s)} style={{background:"#213e57",border:"1px solid #b3dff3",borderRadius:10,color:"#fff",padding:"10px 15px"}}>{cancelling===s.id?"Requesting cancellation…":"Cancel monthly subscription"}</button>:null}
          </article>):<p style={{color:"#bcd3e5"}}>No verified recurring subscription records for this account.</p>}
          {billing?.history?.length>0&&<><h3>Verified billing events</h3>{billing.history.map((ev,i)=><p key={ev.id||i} style={{fontSize:13}}>{ev.type} · {ev.verifiedAt?new Date(ev.verifiedAt).toLocaleString():"Pending verification"}</p>)}</>}
        </section>
        <AutoLikesDrafts/>
      </>}
      <a style={{color:"#a9e3ff"}} href="/track">Track an order</a>
    </div>
  </main>;
}
