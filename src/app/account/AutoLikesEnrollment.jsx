"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// The existing Litix PayKings/NMI Collect.js integration is reused.
// Browser code never sees the gateway secret or raw card numbers.
export default function AutoLikesEnrollment({campaign,onComplete}) {
 const [quote,setQuote]=useState(null),[available,setAvailable]=useState(false),[busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false),[consent,setConsent]=useState(false),[error,setError]=useState(""),[result,setResult]=useState(null);
 const [opened,setOpened]=useState(false);
 const submitRef=useRef(null),keyRef=useRef(null);
 const open=async()=>{
  setError("");setOpened(true);setReady(false);setResult(null);setConsent(false);
  keyRef.current=crypto.randomUUID();
  try{
   const r=await fetch("/api/account/billing?campaignId="+encodeURIComponent(campaign.id),{cache:"no-store"});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||"Unable to quote the subscription.");
   setQuote(d.quote);setAvailable(Boolean(d.liveSubscriptionsAvailable));
  }catch(e){setError(String(e.message||"Unable to load the monthly price."))}
 };
 const sendToken=useCallback(async(token)=>{
  if(!quote || !keyRef.current || busy)return;
  setBusy(true);setError("");
  try{
   const res=await fetch("/api/account/billing",{
    method:"POST",credentials:"same-origin",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({campaignId:campaign.id,requestKey:keyRef.current,paymentToken:token,
     expectedMonthlyCents:quote.monthlyCents,consentToMonthlyRenewal:true,consentVersion:"2026-10"})
   });
   const body=await res.json();
   if(!res.ok)throw Error(body.error||"Subscription enrollment could not be completed.");
   setResult(body);
   // A pending gateway enrollment is NOT permission to fulfill posts.
   onComplete?.(body);
  }catch(e){setError(String(e.message||"Payment status is unknown. Check your subscriptions before any new attempt."))}
  finally{setBusy(false)}
 },[campaign.id,quote,busy,onComplete]);
 submitRef.current=sendToken;
 useEffect(()=>{
  if(!opened||!quote||!available||result)return;
  let mounted=true,poll=null,deadline=null,script=null;
  const keyPromise=fetch("/api/config",{cache:"no-store"}).then(r=>r.json()).then(cfg=>{
   if(!mounted)return;
   const key=cfg.publicKey;
   if(!cfg.ready||typeof key!=="string"||key.length<8)throw Error("Secure PayKings tokenization is unavailable.");
   const initialize=()=>{
    const c=window.CollectJS;
    if(!mounted||!c||typeof c.configure!=="function")return false;
    const fields=["al-ccnumber","al-ccexp","al-cvv"].map(id=>document.getElementById(id));
    if(!fields.every(x=>x&&x.getClientRects().length))return false;
    try{
     c.configure({
      variant:"inline",styleSniffer:false,
      customCss:{"font-size":"16px","font-family":"sans-serif",color:"#eff8ff","background-color":"transparent"},
      fields:{
       ccnumber:{selector:"#al-ccnumber",title:"Card number",placeholder:"Card number"},
       ccexp:{selector:"#al-ccexp",title:"Expiration date",placeholder:"MM / YY"},
       cvv:{selector:"#al-cvv",title:"Security code",placeholder:"CVV"}
      },
      callback:result=>{if(mounted&&result?.token)submitRef.current?.(result.token);else if(mounted)setError("Secure card tokenization failed. Review card fields before trying again.")},
      fieldsAvailableCallback:()=>{if(mounted)setReady(true)}
     });return true;
    }catch{if(mounted)setError("PayKings card fields could not initialize.");return true}
   };
   script=document.createElement("script");
   script.src="https://secure.nmi.com/token/Collect.js?v="+Date.now();
   script.setAttribute("data-tokenization-key",key);
   script.setAttribute("data-variant","inline");
   script.setAttribute("data-style-sniffer","false");
   script.setAttribute("data-field-ccnumber-selector","#al-ccnumber");
   script.setAttribute("data-field-ccexp-selector","#al-ccexp");
   script.setAttribute("data-field-cvv-selector","#al-cvv");
   script.async=true;
   script.onerror=()=>{if(mounted)setError("PayKings secure card service did not load.")};
   document.body.appendChild(script);
   poll=window.setInterval(()=>{if(initialize()&&poll){window.clearInterval(poll);poll=null}},150);
   deadline=window.setTimeout(()=>{if(mounted&&!window.CollectJS?.configure)setError("PayKings secure card service timed out. No charge was submitted.")},15000);
  }).catch(e=>{if(mounted)setError(String(e.message||"PayKings unavailable"))});
  return()=>{mounted=false;if(poll)window.clearInterval(poll);if(deadline)window.clearTimeout(deadline);if(script)script.remove();void keyPromise};
 },[opened,quote,available,result]);
 const pay=()=>{
  if(busy||!ready||!consent||!available)return;
  setError("");
  const c=window.CollectJS;
  if(!c||typeof c.startPaymentRequest!=="function"){setError("Secure payment fields are not ready.");return}
  setBusy(true);
  try{c.startPaymentRequest()}catch{setError("PayKings could not tokenize the card.");setBusy(false)}
 };
 const money=c=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(c||0)/100);
 const style={background:"#091d2e",padding:15,borderRadius:13,border:"1px solid #467491",display:"grid",gap:12};
 return <div style={{marginTop:14}}>
  {!opened&&<button type="button" onClick={open} style={{padding:"12px 16px",border:"1px solid #81c4ed",background:"#20577e",borderRadius:11,color:"white",fontWeight:700}}>Review monthly AutoLikes plan</button>}
  {opened&&<div style={style}>
   <strong style={{fontSize:18}}>Monthly subscription checkout</strong>
   {!quote&&!error&&<p>Checking the current supplier-backed monthly price…</p>}
   {quote&&<div>
    <strong>{money(quote.monthlyCents)} per month</strong>
    <p style={{margin:"6px 0",color:"#c4dbe9"}}>{quote.quantity.toLocaleString()} likes per new post · up to {quote.maxPosts} posts/month · {quote.serviceName}</p>
    <p style={{fontSize:13,color:"#c4dbe9"}}>Your subscription renews monthly until canceled. An initial charge may occur immediately or when PayKings schedules it. The maximum monthly amount shown above is fixed at enrollment; new pricing requires new consent.</p>
   </div>}
   {quote&&!available&&<p role="status" style={{color:"#ffd9a7"}}>Live recurring billing is not enabled for this merchant account yet. No card details are requested or charged.</p>}
   {quote&&available&&!result&&<>
    <div style={{display:"grid",gap:8}}>
     <label>Card number (PayKings secure field)<div id="al-ccnumber" style={{minHeight:52,background:"#071421",border:"1px solid #547896",borderRadius:7}}/></label>
     <label>Expiration<div id="al-ccexp" style={{minHeight:52,background:"#071421",border:"1px solid #547896",borderRadius:7}}/></label>
     <label>Security code<div id="al-cvv" style={{minHeight:52,background:"#071421",border:"1px solid #547896",borderRadius:7}}/></label>
    </div>
    <label style={{display:"flex",gap:12,alignItems:"flex-start",lineHeight:1.5}}>
     <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
     I authorize Litix to bill my card {money(quote.monthlyCents)} each month until I cancel, and understand I can cancel future renewals in my account.
    </label>
    <button type="button" disabled={!consent||!ready||busy} onClick={pay} style={{padding:14,borderRadius:9,background:"#236a93",color:"white",fontWeight:800,opacity:!consent||!ready||busy?.6:1}}>
     {busy?"Submitting securely…":"Start monthly subscription — "+money(quote.monthlyCents)}
    </button>
   </>}
   {result&&<p role="status" style={{color:"#b3f4d6"}}>{result.message||"Subscription request recorded. Check your billing history."}</p>}
   {error&&<p role="alert" style={{color:"#ffc1c1"}}>{error}</p>}
   <button type="button" onClick={()=>{setOpened(false);setQuote(null);setAvailable(false);setReady(false);setResult(null);setError("")}} style={{padding:10,color:"#d6edfc",background:"transparent",border:"1px solid #668ba3",borderRadius:9}}>Close</button>
  </div>}
 </div>;
}
