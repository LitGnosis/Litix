"use client";
import {useCallback,useEffect,useRef,useState} from "react";

const field={width:"100%",minHeight:46,padding:"11px 12px",color:"#e7f3ff",
 background:"#092440",border:"1px solid #47759d",borderRadius:10,fontSize:16};
const text={color:"#b6cfe6",lineHeight:1.55,fontSize:14};
const action={background:"#2474c1",border:"1px solid #73b4ea",color:"#fff",
 padding:"15px 21px",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer"};

export default function FollowerCheckout(){
 const [platform,setPlatform]=useState("instagram");
 const [quantity,setQuantity]=useState("");
 const [quote,setQuote]=useState(null);
 const [priceError,setPriceError]=useState("");
 const [email,setEmail]=useState("");
 const [profile,setProfile]=useState("");
 const [publicKey,setPublicKey]=useState("");
 const [cardStatus,setCardStatus]=useState("loading");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [result,setResult]=useState(null);
 const [loading,setLoading]=useState(true);
 const activeQuote=useRef(null),attemptKey=useRef(null);
 const paymentSent=useRef(false),tokenTimeout=useRef(null);
 const tokenExpired=useRef(false),latestPayment=useRef(null);
 const checkQuote=useCallback(async(platform,qty,signal)=>{
  const query=new URLSearchParams({platform});
  if(qty!==null&&qty!=="")query.set("quantity",qty);
  const r=await fetch("/api/followers?"+query,{cache:"no-store",signal});
  const body=await r.json();
  if(!r.ok||!body.available||!body.checkoutEnabled)
   throw Error(body.error||"The selected follower package is not available.");
  return body;
 },[]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setQuote(null);setPriceError("");
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try{
    const q=await checkQuote(platform,quantity||null,controller.signal);
    if(!alive)return;
    activeQuote.current=q;setQuote(q);
    if(!quantity)setQuantity(String(q.quantity));
   }catch(e){
    if(!alive||controller.signal.aborted)return;
    activeQuote.current=null;setPriceError(String(e.message||"Service unavailable."));
   }finally{if(alive)setLoading(false)}
  },380);
  return()=>{alive=false;clearTimeout(timer);controller.abort()};
 },[platform,quantity,checkQuote]);
 useEffect(()=>{
  let active=true;
  fetch("/api/config",{cache:"no-store"}).then(r=>r.json()).then(c=>{
   if(active){setPublicKey(c?.publicKey||"");if(!c?.publicKey)setCardStatus("unavailable")}
  }).catch(()=>{if(active)setCardStatus("unavailable")});
  return()=>{active=false};
 },[]);
 const doPurchase=async(token)=>{
  const q=activeQuote.current;
  if(!q||!token||paymentSent.current)return;
  paymentSent.current=true;
  const idem=attemptKey.current||crypto.randomUUID();
  attemptKey.current=idem;
  try{
   const r=await fetch("/api/followers",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({platform:q.platform,quantity:q.quantity,email:email.trim(),
     destination:profile.trim(),expectedAmountCents:q.amountCents,
     paymentToken:token,idempotencyKey:idem}),
    signal:AbortSignal.timeout(60000)
   });
   const v=await r.json();
   setResult(v);
   if(v.orderId&&v.secret&&v.payment==="paid"){
    const url="/track?track="+encodeURIComponent(v.orderId)+"&token="+encodeURIComponent(v.secret);
    window.location.replace(url);
    return;
   }
   if(v.orderId){
    setError("Order "+v.orderId+": "+(v.message||"Payment outcome requires review.")+
     " Check your card activity before any retry.");
   }else{
    setError(v.error||v.message||"The result is unknown. Do not retry this card payment.");
   }
  }catch{
   setError("Checkout result is unknown. Do not retry; check Litix support and card activity.");
  }finally{setBusy(false)}
 };
 latestPayment.current=doPurchase;
 useEffect(()=>{
  if(!publicKey||paymentSent.current)return;
  let disposed=false,poll=null;
  const script=document.createElement("script");
  script.src="https://secure.nmi.com/token/Collect.js";
  script.async=true;
  script.setAttribute("data-tokenization-key",publicKey);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-style-sniffer","false");
  script.setAttribute("data-field-ccnumber-selector","#follower-ccnumber");
  script.setAttribute("data-field-ccexp-selector","#follower-ccexp");
  script.setAttribute("data-field-cvv-selector","#follower-cvv");
  script.onload=()=>{
   if(disposed)return;
   try{
    window.CollectJS.configure({
     variant:"inline",
     fields:{
      ccnumber:{selector:"#follower-ccnumber",placeholder:"Card number"},
      ccexp:{selector:"#follower-ccexp",placeholder:"MM / YY"},
      cvv:{selector:"#follower-cvv",placeholder:"Security code"}
     },
     callback:result=>{
      if(disposed||paymentSent.current||tokenExpired.current)return;
      if(tokenTimeout.current){clearTimeout(tokenTimeout.current);tokenTimeout.current=null}
      if(!result?.token){setBusy(false);setError("PayKings did not return a payment token; no charge was submitted.");return}
      void latestPayment.current?.(result.token);
     }
    });
    let tries=0;
    poll=setInterval(()=>{
     if(disposed){clearInterval(poll);return}
     const found=["follower-ccnumber","follower-ccexp","follower-cvv"].every(id=>
      document.getElementById(id)?.querySelector("iframe"));
     if(found){clearInterval(poll);setCardStatus("ready")}
     else if(++tries>30){clearInterval(poll);setCardStatus("unavailable")}
    },500);
   }catch{setCardStatus("unavailable")}
  };
  script.onerror=()=>{if(!disposed)setCardStatus("unavailable")};
  document.head.append(script);
  return()=>{disposed=true;clearInterval(poll);if(tokenTimeout.current)clearTimeout(tokenTimeout.current);script.remove()};
 },[publicKey]);
 const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
 const isProfile=profile.trim().length>=2;
 const canSubmit=quote?.available===true&&!loading&&cardStatus==="ready"&&!!publicKey&&
    validEmail&&isProfile&&!busy&&!paymentSent.current;
 return <main style={{background:"linear-gradient(135deg,#041426,#123f70)",minHeight:"100vh",
  color:"#e9f5ff",padding:"20px 14px 60px"}}>
  <div style={{maxWidth:680,margin:"auto"}}>
   <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,marginBottom:20}}>
    <a href="/" style={{color:"#e9f5ff",fontWeight:900,fontSize:23,textDecoration:"none"}}>LITIX.NET</a>
    <a href="/track" style={{color:"#b4dcff"}}>Track Order</a>
   </header>
   <div style={{border:"1px solid #487aa6",padding:"clamp(20px,5vw,36px)",background:"#071d35",borderRadius:20}}>
    <p style={{letterSpacing:2,color:"#8bc2f4",fontWeight:800}}>LIVE FOLLOWS · SECURE CHECKOUT</p>
    <h1 style={{fontSize:"clamp(28px,5vw,43px)",margin:"12px 0"}}>Buy Followers</h1>
    <p style={text}>Purchase a genuine paid Litix follower order. Price and supplier capacity are checked live before you can submit your card. Order status is shown on your private tracking page.</p>
    <div style={{display:"grid",gap:15,marginTop:24}}>
     <label style={{fontWeight:700,display:"grid",gap:7}}>Platform
      <select value={platform} onChange={e=>{setPlatform(e.target.value);setQuantity("");setQuote(null)}}
        disabled={busy||paymentSent.current} style={field}>
       <option value="instagram">Instagram Followers</option>
       <option value="tiktok">TikTok Followers</option>
      </select></label>
     <label style={{fontWeight:700,display:"grid",gap:7}}>Public profile / @username
      <input style={field} type="text" autoCapitalize="off" autoComplete="off" value={profile}
       onChange={e=>setProfile(e.target.value)} maxLength={180} placeholder="@username or profile URL"
       disabled={busy||paymentSent.current}/></label>
     <label style={{fontWeight:700,display:"grid",gap:7}}>Follower quantity
      <input style={field} type="number" min={quote?.minimum||1} max={quote?.maximum||1000000}
       value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="Choose quantity"
       disabled={busy||paymentSent.current}/></label>
     <label style={{fontWeight:700,display:"grid",gap:7}}>Receipt email
      <input style={field} type="email" autoComplete="email" value={email}
       onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
       disabled={busy||paymentSent.current}/></label>
    </div>
    <div style={{background:"#0c2b4e",border:"1px solid #47779e",
      borderRadius:14,padding:18,margin:"22px 0"}}>
     <div style={{color:"#b9d8ef"}}>Live follower service price</div>
     <div style={{fontSize:38,fontWeight:900,margin:"5px 0"}}>
      {quote&&!loading?"$"+(quote.amountCents/100).toFixed(2):"—"}
     </div>
     {loading?<p style={text}>Checking live service, quantity, balance and price…</p>:
      priceError?<p role="alert" style={{color:"#ffb3b6"}}>{priceError}</p>:
      quote?<p style={text}>{quote.quantity.toLocaleString()} {platform} followers. Minimum {quote.minimum.toLocaleString()}. Final price checked again before charging.</p>:null}
    </div>
    <section aria-label="PayKings secure payment" style={{display:"grid",gap:12}}>
     <h2 style={{margin:"0 0 2px"}}>PayKings secure card checkout</h2>
     <p style={text}>Your card is tokenized in secure payment fields. We do not ask you for a social-platform password.</p>
     <label>Card number<div id="follower-ccnumber" style={{minHeight:47,background:"#fff",borderRadius:8,marginTop:5}}/></label>
     <label>Expiration<div id="follower-ccexp" style={{minHeight:47,background:"#fff",borderRadius:8,marginTop:5}}/></label>
     <label>Security code<div id="follower-cvv" style={{minHeight:47,background:"#fff",borderRadius:8,marginTop:5}}/></label>
     {cardStatus!=="ready"&&<p style={text}>{cardStatus==="loading"?"Loading secure fields…":"Card fields unavailable. No charge has been submitted."}</p>}
     <button type="button" style={{...action,width:"100%",marginTop:8,
       opacity:canSubmit?1:.55,cursor:canSubmit?"pointer":"not-allowed"}}
      disabled={!canSubmit}
      onClick={()=>{
       if(!canSubmit)return;
       setError("");setBusy(true);tokenExpired.current=false;
       tokenTimeout.current=setTimeout(()=>{
        if(paymentSent.current)return;
        tokenTimeout.current=null;tokenExpired.current=true;
        setBusy(false);setError("Secure tokenization timed out. No checkout request was submitted from this page. Check activity before retrying.");
       },25000);
       try{window.CollectJS.startPaymentRequest()}
       catch{if(tokenTimeout.current)clearTimeout(tokenTimeout.current);
        tokenTimeout.current=null;setBusy(false);setError("Complete all card fields before paying. No payment was sent.")}
      }}>{busy?"Processing securely — do not retry":
         quote?"Pay $"+(quote.amountCents/100).toFixed(2)+" once":"Select an available package"}</button>
    </section>
    {error&&<p role="alert" style={{color:"#ffc1c7",background:"#452339",
     border:"1px solid #a85364",padding:12,borderRadius:10}}>{error}</p>}
    {result?.orderId&&<p style={text}>Order: {result.orderId}. If checkout needs review, do not pay twice. <a href="/track" style={{color:"#b5dfff"}}>Go to order tracking</a>.</p>}
    <p style={{...text,marginTop:22}}>A successful charge starts the fulfillment attempt; followers may arrive gradually. Delivery is not guaranteed instantly, and the final status must be confirmed separately. <a href="/terms" style={{color:"#aedbff"}}>Terms</a> · <a href="/refunds" style={{color:"#aedbff"}}>Refund policy</a></p>
   </div>
  </div>
 </main>;
}
