"use client";
import { useEffect, useState } from "react";

const ink="#e9f3ff",muted="#a9c4d5",blue="#73c5ed";
export default function ConfirmationPage(){
 const [receipt,setReceipt]=useState(null);
 const [status,setStatus]=useState("");
 const [remaining,setRemaining]=useState(18);
 const [autoHome,setAutoHome]=useState(true);
 const [copied,setCopied]=useState(false);
 useEffect(()=>{
  document.title="Order confirmation | Litix";
  let stored=null;
  try{stored=JSON.parse(sessionStorage.getItem("litix:last-confirmation")||"null")}catch{}
  const id=new URLSearchParams(window.location.search).get("order");
  if(!stored?.orderId||!stored?.trackingUrl||(id&&id!==stored.orderId)){setStatus("Your receipt is not available in this browser. Use the private tracking link saved after checkout.");setAutoHome(false);return}
  setReceipt(stored);
  try{
   const u=new URL(stored.trackingUrl);
   const orderId=u.searchParams.get("track"),token=u.searchParams.get("token");
   if(!orderId||!token||orderId!==stored.orderId)throw Error("Invalid tracking link");
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),10000);
   fetch("/api/track?id="+encodeURIComponent(orderId)+"&token="+encodeURIComponent(token),{cache:"no-store",signal:controller.signal})
     .then(async r=>{if(!r.ok)throw Error("Tracking status is temporarily unavailable.");return r.json()})
     .then(body=>{if(body.order?.payment)setReceipt(old=>old?{...old,payment:body.order.payment,fulfillment:body.order.fulfillment||old.fulfillment}:old)})
     .catch(()=>setStatus("The tracking service could not refresh yet. Your private tracking link is saved below."))
     .finally(()=>clearTimeout(timeout));
   return()=>{controller.abort();clearTimeout(timeout)};
  }catch{setStatus("Unable to refresh tracking status. Keep the private link below.")}
 },[]);
 useEffect(()=>{
  if(!receipt||!autoHome)return;
  if(remaining<=0){window.location.replace("/");return}
  const interval=setTimeout(()=>setRemaining(n=>n-1),1000);
  return()=>clearTimeout(interval);
 },[remaining,autoHome,receipt]);
 async function copyTracking(){
  try{await navigator.clipboard.writeText(receipt.trackingUrl);setCopied(true)}catch{setStatus("Select and copy the tracking link shown below.")}
 }
 const paid=receipt?.payment==="paid";
 const box={background:"linear-gradient(160deg,#0d2e43,#091d2e)",border:"1px solid #31617a",borderRadius:20,padding:24,boxShadow:"0 18px 45px #0006"};
 const button={display:"inline-block",padding:"13px 19px",borderRadius:12,background:"#194562",border:"1px solid #5087a4",color:ink,fontWeight:700,cursor:"pointer",fontSize:16,textDecoration:"none"};
 return <main style={{minHeight:"100vh",background:"radial-gradient(ellipse at top,#102b40 0%,#06101b 65%)",color:ink,fontFamily:"system-ui,-apple-system,sans-serif",padding:"28px 16px 60px"}}>
  <div style={{maxWidth:680,margin:"0 auto"}}>
   <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,marginBottom:32}}>
    <a href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" alt="Litix" style={{width:118,height:"auto"}}/></a>
    <a href="/" style={{...button,background:"transparent"}}>Home</a>
   </header>
   <section style={box} role="status" aria-live="polite">
    <div style={{fontSize:14,letterSpacing:2,color:blue,fontWeight:700}}>LITIX ORDER CONFIRMATION</div>
    <h1 style={{fontSize:"clamp(28px,6vw,40px)",lineHeight:1.15,margin:"18px 0"}}>{paid?"Payment confirmed":"Order information"}</h1>
    {receipt?<>
     <p style={{fontSize:18,color:muted,margin:"0 0 22px"}}>{paid?"Your payment was approved. Your order details and private tracking link are below.":"Your order is still being reviewed. Do not submit another payment."}</p>
     <div style={{borderTop:"1px solid #375b6b",paddingTop:18,display:"grid",gap:13}}>
      <div><div style={{color:muted,fontSize:13}}>Order number</div><div style={{overflowWrap:"anywhere",fontWeight:700}}>{receipt.orderId}</div></div>
      <div><div style={{color:muted,fontSize:13}}>Payment / supplier</div><div style={{textTransform:"capitalize"}}>{receipt.payment} · {String(receipt.fulfillment||"pending").replaceAll("_"," ")}</div></div>
      <div><div style={{color:muted,fontSize:13}}>Total</div><div style={{fontSize:27,fontWeight:800}}>USD {new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((receipt.amountCents||0)/100)}</div></div>
      <div><div style={{color:muted,fontSize:13}}>Service</div><div>{receipt.service}</div></div>
     </div>
     <div style={{marginTop:25,borderTop:"1px solid #375b6b",paddingTop:20}}>
      <h2 style={{fontSize:21,margin:"0 0 8px"}}>Private tracking link</h2>
      <p style={{color:muted,fontSize:14}}>Keep this link private. You can use it to check your order status.</p>
      <input aria-label="Your private tracking URL" readOnly value={receipt.trackingUrl} onFocus={e=>e.target.select()} style={{width:"100%",boxSizing:"border-box",padding:"15px 12px",background:"#07131d",border:"1px solid #487088",borderRadius:10,color:ink,fontSize:15}}/>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
       <button style={button} type="button" onClick={copyTracking}>{copied?"Copied":"Copy tracking link"}</button>
       <a href={receipt.trackingUrl} style={button}>Track order</a>
      </div>
     </div>
    </>:<p style={{color:muted}}>{status||"Loading your order details..."}</p>}
    {status&&receipt&&<p style={{color:muted,fontSize:14,marginTop:18}}>{status}</p>}
   </section>
   {receipt&&<div style={{...box,marginTop:20}}>
    <p style={{marginTop:0}}>Thank you for your order. Save the tracking link before leaving this page, even if you expect an email confirmation.</p>
    {autoHome?<p style={{color:muted}}>Returning to the Litix home page in <b style={{color:ink}}>{remaining}</b> seconds.</p>:<p style={{color:muted}}>Automatic return paused.</p>}
    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
     <a style={button} href="/">Go to home page</a>
     <button style={{...button,background:"transparent"}} type="button" onClick={()=>setAutoHome(v=>!v)}>{autoHome?"Stay on confirmation":"Resume automatic return"}</button>
    </div>
   </div>}
  </div>
 </main>
}
