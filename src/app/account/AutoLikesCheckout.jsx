"use client";
import {useEffect,useRef,useState} from "react";

// The existing NMI Collect.js library owns every card field. Litix never receives card numbers.
const getCollect=()=>typeof window!=="undefined"?window.CollectJS:null;
const style={padding:"12px",border:"1px solid #547a93",borderRadius:11,color:"#fff",background:"#091d2c"};
export default function AutoLikesCheckout({campaign,onClose}){
 const [config,setConfig]=useState(null),[quote,setQuote]=useState(null),[ready,setReady]=useState(false),
       [monitoringConsent,setMonitoringConsent]=useState(false),
       [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const requestKey=useRef(""),purchaseRef=useRef(null),enrollmentSubmitted=useRef(false);
 useEffect(()=>{requestKey.current=crypto.randomUUID();enrollmentSubmitted.current=false;setQuote(null);setReady(false);setMessage("");setConsent(false);setMonitoringConsent(false);const ctl=new AbortController();
  Promise.all([
   fetch("/api/account/subscribe/config",{cache:"no-store",signal:ctl.signal}).then(r=>r.json()),
   fetch("/api/account/subscribe/quote",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({platform:campaign.platform,serviceId:campaign.serviceId,quantityPerPost:campaign.quantityPerPost,maxPostsPerMonth:campaign.maxPostsPerMonth}),signal:ctl.signal}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Monthly quote unavailable");return v.quote})
  ]).then(([cfg,q])=>{if(!ctl.signal.aborted){setConfig(cfg);setQuote(q)}})
    .catch(e=>{if(!ctl.signal.aborted)setMessage(e.message)});
  return()=>ctl.abort();
 },[campaign.id]);

 async function enroll(token){
  if(enrollmentSubmitted.current||!consent||!monitoringConsent||!config?.enabled||!quote)return;
  // Tokenization sets busy before this callback. Lock exactly once when a live token arrives.
  enrollmentSubmitted.current=true;
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/account/subscribe",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({
    campaignId:campaign.id,requestKey:requestKey.current,paymentToken:token,consent:true,monitoringConsent:true,consentVersion:"autolikes-recurring-v1"
   })});
   const v=await response.json();
   if(!response.ok && response.status!==202)throw Error(v.error||"Subscription was not approved");
   setMessage(v.message||v.error||"Enrollment recorded. Verify status before retrying.");
  }catch(e){setMessage(e.message+" Do not resubmit until the previous attempt is reconciled.");}
  finally{setBusy(false)}
 }
 purchaseRef.current=enroll;

 useEffect(()=>{
  if(!config?.enabled||!config.publicKey||!quote)return;
  let active=true,loaded=false,timeout;
  const load=()=>{
   if(!active||loaded||!getCollect()?.configure)return;
   loaded=true;
   try{getCollect().configure({
    variant:"inline",styleSniffer:false,
    customCss:{"font-size":"16px",color:"#ffffff","background-color":"transparent"},
    fields:{
     ccnumber:{selector:"#al-ccnumber",title:"Card number",placeholder:"Card number"},
     ccexp:{selector:"#al-ccexp",title:"Expiration date",placeholder:"MM / YY"},
     cvv:{selector:"#al-cvv",title:"CVV",placeholder:"CVV"}
    },
    callback:r=>{if(!active)return;if(r?.token)purchaseRef.current?.(r.token);else{setBusy(false);setMessage("Tokenization failed. No subscription created.")}},
    fieldsAvailableCallback:()=>{if(active)setReady(true)}
   })}catch{setMessage("Secure card fields could not start. No payment submitted.")}
  };
  const node=document.createElement("script");node.src="https://secure.nmi.com/token/Collect.js?v="+Date.now();
  node.async=true;node.setAttribute("data-tokenization-key",config.publicKey);
  node.onload=()=>{if(active){timeout=setInterval(load,150);load()}};
  node.onerror=()=>{if(active)setMessage("PayKings secure fields unavailable. No subscription submitted.")};
  document.head.appendChild(node);
  return()=>{active=false;if(timeout)clearInterval(timeout);node.remove();setReady(false)};
 },[config?.enabled,config?.publicKey,quote?.amountCents,campaign.id]);

 function submit(e){
  e.preventDefault();
  if(!ready||busy||enrollmentSubmitted.current||!consent||!monitoringConsent||!quote||!config?.enabled)return;
  setBusy(true);setMessage("");
  try{getCollect().startPaymentRequest()}catch{setBusy(false);setMessage("Complete the secure card fields first.")}
 }
 const dollars=quote?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(quote.amountCents/100):"";
 return <section aria-label="Monthly AutoLikes subscription" style={{...style,display:"grid",gap:12}}>
  <strong>Monthly AutoLikes — {campaign.target}</strong>
  <p>{quote?dollars+" per month for up to "+quote.maxPostsPerMonth+" posts, "+quote.quantityPerPost+" likes per post.":"Checking the current Likes service price…"}</p>
  {!config?.enabled?<p role="status">Monthly subscription activation is pending merchant verification. No card payment is available yet.</p>:<>
   <form onSubmit={submit} style={{display:"grid",gap:13}}>
    <div id="al-ccnumber" style={{minHeight:44}} aria-label="Secure card number"/>
    <div id="al-ccexp" style={{minHeight:44}} aria-label="Secure expiration date"/>
    <div id="al-cvv" style={{minHeight:44}} aria-label="Secure card CVV"/>
    <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I authorize Litix to charge {dollars} every month until I cancel, subject to the stated maximum number of posts and likes per post.</label>
    <label><input type="checkbox" checked={monitoringConsent} onChange={e=>setMonitoringConsent(e.target.checked)}/> I confirm I manage this social profile and authorize Litix to monitor new public posts through approved platform access for this subscription.</label>
    <button type="submit" disabled={!ready||!consent||!monitoringConsent||!quote||busy||enrollmentSubmitted.current} style={style}>{busy?"Processing…":"Start monthly subscription"}</button>
   </form>
  </>}
  {message&&<p role="status">{message}</p>}
  <button onClick={onClose} type="button" style={style}>Close</button>
 </section>
}
