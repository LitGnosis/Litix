"use client";
import { useEffect, useState } from "react";
import AutoLikesDrafts from "./AutoLikesDrafts.jsx";
export default function AccountClient({user,provider}){
  const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/account/dashboard",{cache:"no-store",signal:controller.signal})
      .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Dashboard unavailable");return v})
      .then(v=>setData(v)).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[]);
  const panel={border:"1px solid #325977",borderRadius:18,padding:22,background:"#122943"};
  return <main style={{minHeight:"100vh",padding:"24px 16px 70px",color:"#edf5ff",background:"linear-gradient(145deg,#071020,#0a2234)",fontFamily:"system-ui"}}>
    <div style={{maxWidth:850,margin:"0 auto",display:"grid",gap:18}}>
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><a style={{color:"#a9e3ff"}} href="/">Litix Home</a>{provider==="neon"?<button type="button" style={{background:"transparent",border:"1px solid #5986a4",borderRadius:10,color:"#a9e3ff",padding:"10px 14px",cursor:"pointer"}} onClick={async()=>{
        try{
          const {neonBrowserAuth}=await import("../../lib/neonBrowserAuth.js");
          const result=await neonBrowserAuth.signOut();
          if(result.error){setError("Logout could not be completed; please retry.");return}
          window.location.assign("/account");
        }catch{setError("Logout temporarily unavailable.")}
      }}>Log out</button>:<a style={{color:"#a9e3ff"}} href="/auth/logout">Log out</a>}</nav>
      <div style={panel}><div style={{color:"#84cefb",letterSpacing:2,fontSize:13}}>LITIX CUSTOMER CENTER</div><h1>Welcome, {user.name}</h1><p style={{color:"#c0d6e5"}}>{user.email}</p></div>
      {loading&&<p role="status">Loading your orders and campaigns…</p>}
      {error&&<p role="alert">{error}</p>}
      {data&&<>
        <section style={panel}><h2>Your orders</h2>{data.orders.length===0?<p>No linked orders yet. Guest orders paid using your verified email will appear here.</p>:data.orders.map(o=><article key={o.id} style={{borderTop:"1px solid #2d5875",padding:"13px 0"}}>
          <strong style={{overflowWrap:"anywhere"}}>{o.id}</strong><p>{o.service} · {o.quantity} units · {o.amount}</p><p>Payment: {o.payment} · Supplier: {o.fulfillment}</p><a style={{color:"#8edfff"}} href={"/track?order="+encodeURIComponent(o.id)}>Track with your checkout email</a>
        </article>)}</section>
        <AutoLikesDrafts/>
      </>}
      <a style={{color:"#a9e3ff"}} href="/track">Track an order</a>
    </div>
  </main>;
}
