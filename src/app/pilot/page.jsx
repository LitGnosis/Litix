"use client";
import {useCallback,useEffect,useRef,useState} from "react";

const DEFAULT_BRIEF={
 brand:"Litix",campaign:"Litix marketing drafts",
 audience:"Creators and independent businesses",
 pain:"Content planning takes time",
 solution:"Original editable campaign ideas",
 cta:"Explore Litix",
 landingUrl:"https://www.litix.net"
};
const label={brand:"Brand",campaign:"Campaign",audience:"Audience",pain:"Customer problem",
 solution:"Your solution",cta:"Call to action",landingUrl:"Website URL"};
const color={background:"#071527",color:"#eaf5ff",border:"1px solid #2b5380",borderRadius:12,padding:"12px 14px"};
const minor={fontSize:14,color:"#b9cce3",lineHeight:1.55};

export default function LitixDollarPilot(){
 const [brief,setBrief]=useState(DEFAULT_BRIEF),[email,setEmail]=useState("");
 const [data,setData]=useState(null),[publicKey,setPublicKey]=useState("");
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[order,setOrder]=useState(null);
 const [cardState,setCardState]=useState("loading");
 const attempt=useRef(null),onToken=useRef(null),paid=useRef(false);
 const tokenTimeout=useRef(null),tokenTimedOut=useRef(false),paymentRequestSent=useRef(false);
 const loadStatus=useCallback(async(id,token)=>{
  try{
   const u="/api/checkout/pilot?order="+encodeURIComponent(id)+"&token="+encodeURIComponent(token);
   const r=await fetch(u,{cache:"no-store"}),body=await r.json();
   if(r.ok)setOrder(old=>({...old,...body,orderId:id,token}));
  }catch{}
 },[]);
 useEffect(()=>{
  let active=true;
  const p=new URLSearchParams(location.search);
  const id=p.get("order"),token=p.get("token");
  if(id&&token&&/^lpx_[0-9a-f]{32}$/.test(id)&&/^[0-9a-f]{64}$/.test(token)){
   paid.current=true;
   setOrder({orderId:id,token,payment:"checking",fulfillment:"pending"});
   loadStatus(id,token);
  }
  Promise.all([
   fetch("/api/checkout/pilot",{cache:"no-store"}).then(r=>r.json()),
   fetch("/api/config",{cache:"no-store"}).then(r=>r.json())
  ]).then(([pilot,config])=>{
   if(!active)return;
   setData(pilot);
   setPublicKey(config?.publicKey||"");
   // The owned $1 product is validated by the dedicated pilot endpoint,
   // not by reseller-catalog or Boostero readiness from /api/config.
   setReady(pilot?.enabled===true&&!!config?.publicKey);
   if(!pilot?.enabled||!config?.publicKey)
    setCardState("unavailable");
  }).catch(()=>{if(active)setCardState("unavailable")});
  return()=>{active=false};
 },[loadStatus]);
 useEffect(()=>{
  if(!order?.orderId||!order?.token||order.delivered)return;
  const t=setInterval(()=>loadStatus(order.orderId,order.token),15000);
  return()=>clearInterval(t);
 },[order?.orderId,order?.token,order?.delivered,loadStatus]);
 async function purchase(token){
  const key=attempt.current||crypto.randomUUID();
  attempt.current=key;
  try{
   const r=await fetch("/api/checkout/v1",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({product:"website_preview",amountCents:100,
      brief,email,paymentToken:token,idempotencyKey:key}),
    signal:AbortSignal.timeout(60000)
   });
   const body=await r.json();
   if(body.orderId&&body.token){
    paid.current=true;
    const purchaseStatus={...body,orderId:body.orderId,token:body.token};
    setOrder(purchaseStatus);
    const privateTrackingPage=location.pathname+"?order="+encodeURIComponent(body.orderId)+
     "&token="+encodeURIComponent(body.token);
    // Successful approval: open the private tracking view immediately, rather
    // than leaving the customer on a stale processing form. Do not re-charge.
    // Error/review outcomes remain on the page to show the exact response.
    if((r.ok||r.status===202)&&!body.error){
     window.location.replace(privateTrackingPage);
     return;
    }
    history.replaceState(null,"",privateTrackingPage);
   }
   if(!r.ok&&r.status!==202){
    setError(body.error||"Payment could not be verified. Do not retry; check the displayed order status.");
   }else if(body.error){
    setError(body.error.replaceAll("_"," ")+". Do not retry this card payment.");
   }else setError("");
  }catch{setError("The result is unknown. Do not repeat the charge; contact Litix support.");}
  finally{setBusy(false)}
 }
 onToken.current=purchase;
 useEffect(()=>{
  if(!ready||!publicKey||paid.current)return;
  let disposed=false,script=document.createElement("script"),poll;
  setCardState("loading");
  script.src="https://secure.nmi.com/token/Collect.js";
  script.async=true;
  script.setAttribute("data-tokenization-key",publicKey);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-style-sniffer","false");
  script.setAttribute("data-field-ccnumber-selector","#ccnumber");
  script.setAttribute("data-field-ccexp-selector","#ccexp");
  script.setAttribute("data-field-cvv-selector","#cvv");
  script.onload=()=>{
   if(disposed)return;
   try{
    window.CollectJS.configure({
     variant:"inline",fields:{
      ccnumber:{selector:"#ccnumber",placeholder:"Card number"},
      ccexp:{selector:"#ccexp",placeholder:"MM / YY"},
      cvv:{selector:"#cvv",placeholder:"Security code"}
     },
     callback:(result)=>{
      // Ignore delayed token callbacks after a timed-out browser tokenization.
      if(disposed||tokenTimedOut.current||paymentRequestSent.current)return;
      if(tokenTimeout.current!==null){clearTimeout(tokenTimeout.current);tokenTimeout.current=null;}
      const token=result?.token;
      if(!token){setBusy(false);setError("Secure payment token missing. No checkout request sent.");return}
      paymentRequestSent.current=true;
      paid.current=true; // no second live sale from a stale/clicked-again checkout
      void onToken.current?.(token);
     }
    });
    let tries=0;
    poll=setInterval(()=>{
     if(disposed){clearInterval(poll);return}
     if(["ccnumber","ccexp","cvv"].every(id=>document.getElementById(id)?.querySelector("iframe"))){
      clearInterval(poll);setCardState("ready");
     }else if(++tries>30){clearInterval(poll);setCardState("unavailable")}
    },500);
   }catch{setCardState("unavailable")}
  };
  script.onerror=()=>{if(!disposed)setCardState("unavailable")};
  document.head.append(script);
  return()=>{disposed=true;clearInterval(poll);if(tokenTimeout.current!==null){clearTimeout(tokenTimeout.current);tokenTimeout.current=null;}script.remove()};
 },[ready,publicKey]);
 const buttonStyle={...color,cursor:"pointer",background:"#1e67ad",fontWeight:700,minHeight:48};
 const cannotPay=!ready||cardState!=="ready"||busy||!!order||paid.current||!email.includes("@");
 return <main style={{background:"linear-gradient(150deg,#06101f,#102647 65%,#051120)",color:"#eaf5ff",minHeight:"100vh",padding:"32px 16px",fontFamily:"system-ui,sans-serif"}}>
  <div style={{maxWidth:680,margin:"0 auto"}}>
   <a href="/" style={{color:"#b6dfff",textDecoration:"none"}}>Litix Home</a>
   <h1 style={{fontSize:"clamp(28px,6vw,44px)",letterSpacing:"-.03em",marginBottom:8}}>
    Litix Original Marketing Drafts</h1>
   <p style={{...minor,fontSize:16}}>Secure one-time checkout for <strong>12 original editable marketing drafts</strong>,
    created by Litix. This is not a Likes, Followers, or Views purchase.</p>
   <div style={{...color,margin:"18px 0",background:"#0a1e38"}}>
    <div style={{fontSize:13,color:"#b9cce3"}}>One-time price · no subscription</div>
    <div style={{fontSize:40,fontWeight:800}}>$1.00</div>
    <p style={minor}>A successful card authorization is not proof of settlement.
     Delivery begins only after independent PayKings settlement verification.
     Never retry the same payment if its outcome is unclear.</p>
   </div>
   {order?<section style={{...color,marginBottom:20}}>
    <h2>Order status</h2>
    <p><strong>Order:</strong> {order.orderId}</p>
    <p><strong>Payment:</strong> {String(order.payment||"checking").replaceAll("_"," ")}</p>
    <p><strong>Fulfillment:</strong> {String(order.fulfillment||"pending").replaceAll("_"," ")}</p>
    {order.delivered&&<p>Delivery completed. Your creative drafts are ready below.</p>}
    {order.kit&&<pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:350,overflow:"auto",padding:12,background:"#07101f",borderRadius:8}}>{JSON.stringify(order.kit,null,2)}</pre>}
    <button style={buttonStyle} onClick={()=>loadStatus(order.orderId,order.token)}>Check payment and delivery</button>
    <p style={minor}>Save this private tracking page. Do not share its full URL.</p>
   </section>:<>
    <section style={{...color,marginBottom:16}}>
     <h2 style={{marginTop:0}}>Your delivery information</h2>
     <label style={{display:"grid",gap:6,fontWeight:600}}>Contact email (tracking appears on this page)
      <input style={color} type="email" autoComplete="email" required value={email}
       onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
     <details style={{marginTop:14}}><summary style={{cursor:"pointer"}}>Customize your creative brief</summary>
      <div style={{display:"grid",gap:12,marginTop:14}}>{Object.entries(label).map(([field,name])=>
       <label key={field} style={{display:"grid",gap:5}}>{name}<input style={color} value={brief[field]}
        onChange={e=>setBrief(old=>({...old,[field]:e.target.value}))}/></label>)}</div>
     </details>
    </section>
    {ready?<section style={{...color,marginBottom:16}}>
     <h2 style={{marginTop:0}}>Pay securely with PayKings</h2>
     <p style={minor}>Card details stay in PayKings-hosted fields, never on Litix servers.</p>
     <div style={{display:"grid",gap:12}}>
      <div><label htmlFor="ccnumber">Card number</label><div id="ccnumber" style={{minHeight:45,background:"#fff",borderRadius:8,marginTop:6}}/></div>
      <div><label htmlFor="ccexp">Expiration</label><div id="ccexp" style={{minHeight:45,background:"#fff",borderRadius:8,marginTop:6}}/></div>
      <div><label htmlFor="cvv">Security code</label><div id="cvv" style={{minHeight:45,background:"#fff",borderRadius:8,marginTop:6}}/></div>
     </div>
     {cardState!=="ready"&&<p style={minor}>{cardState==="loading"?"Loading secure card fields...":"Card fields are unavailable. No charge has been submitted."}</p>}
     <button style={{...buttonStyle,marginTop:18,width:"100%",opacity:cannotPay?.5:1}}
      disabled={cannotPay} onClick={()=>{
       if(cannotPay)return;setError("");setBusy(true);
       tokenTimedOut.current=false;
       tokenTimeout.current=window.setTimeout(()=>{
        tokenTimeout.current=null;
        if(paymentRequestSent.current)return;
        tokenTimedOut.current=true;
        setBusy(false);setCardState("unavailable");
        setError("PayKings tokenization did not finish. Litix did not submit a checkout request from this page. Check account activity before any further attempt.");
       },25000);
       try{window.CollectJS.startPaymentRequest()}catch{
        if(tokenTimeout.current!==null){clearTimeout(tokenTimeout.current);tokenTimeout.current=null;}
        setBusy(false);setError("Please complete your secure card fields. No payment was submitted.");
       }
      }}>{busy?"Processing—do not retry":"Pay $1.00 once"}</button>
    </section>:<section style={{...color,marginBottom:16}}>
     <h2 style={{marginTop:0}}>Payment disabled</h2>
     <p style={minor}>This first-party product checkout is temporarily unavailable.
      No card payment will be attempted.</p>
    </section>}
   </>}
   {error&&<p role="alert" style={{...color,borderColor:"#cb6477",background:"#371a2b"}}>{error}</p>}
   <p style={minor}><strong>Available now:</strong> <a href="/direct-services" style={{color:"#b6dfff"}}>Try Litix's free creative studio</a> without a card.</p>
  </div>
 </main>;
}
