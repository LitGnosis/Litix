"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import PremiumInlineCheckout from "../../components/PremiumInlineCheckout";
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const delayChoices=[0,5,10,15,20,30,40,50,60];
const getCollectJS=()=>{try{if(typeof CollectJS!=="undefined")return CollectJS}catch{}return typeof window!=="undefined"?window.CollectJS:null};
export default function AutoLikesPage(){
 const [catalog,setCatalog]=useState({loading:true,items:[],checkoutEnabled:false});
 const [platform,setPlatform]=useState("instagram"),[serviceId,setServiceId]=useState("");
 const [profile,setProfile]=useState(""),[quantity,setQuantity]=useState("1000"),[posts,setPosts]=useState("10");
 const [delay,setDelay]=useState("0"),[email,setEmail]=useState(""),[day,setDay]=useState("1");
 const [consent,setConsent]=useState(false),[monitorConsent,setMonitorConsent]=useState(false);
 const [quote,setQuote]=useState(null),[requestKey,setRequestKey]=useState("");
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[cardReady,setCardReady]=useState(false);
 const [publicKey,setPublicKey]=useState(""),[message,setMessage]=useState(""),[portal,setPortal]=useState("");
 const [locked,setLocked]=useState(false);
 const callback=useRef(null);
 useEffect(()=>{
  const a=new AbortController();
  fetch("/api/autolikes/catalog",{cache:"no-store",signal:a.signal}).then(r=>r.json()).then(v=>{
   if(a.signal.aborted)return;
   setCatalog({loading:false,items:Array.isArray(v.items)?v.items:[],
    checkoutEnabled:v.checkoutEnabled===true,note:v.note||""});
  }).catch(()=>{if(!a.signal.aborted)setCatalog({loading:false,items:[],checkoutEnabled:false,note:"AutoLikes verification temporarily unavailable"})});
  fetch("/api/config",{cache:"no-store",signal:a.signal}).then(r=>r.json()).then(v=>{
   if(!a.signal.aborted&&v.ready&&v.publicKey)setPublicKey(v.publicKey);
  }).catch(()=>{});
  setDay(String(Math.min(28,new Date().getDate())));
  return()=>a.abort();
 },[]);
 const available=useMemo(()=>catalog.items.filter(x=>x.platform===platform),[catalog.items,platform]);
 const chosen=available.find(x=>x.id===serviceId)||null;
 const edit=setter=>value=>{setter(value);setQuote(null);setMessage("");setCardReady(false)};
 useEffect(()=>{
  if(chosen)return;
  setServiceId(available[0]?.id||"");
 },[platform,catalog.items,serviceId]);
 async function requestQuote(event){
  event.preventDefault();setLoading(true);setMessage("");setQuote(null);
  try{
   const res=await fetch("/api/autolikes/quote",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({platform,serviceId,profile,expectedAmountCents:quote.monthlyAmountCents,quantityPerPost:Number(quantity),posts:Number(posts),delay:Number(delay)})});
   const body=await res.json();
   if(!res.ok)throw Error(body.error||"Unable to confirm the latest price");
   setQuote(body.quote);setRequestKey(crypto.randomUUID());
  }catch(e){setMessage(e.message||"Unable to prepare a subscription quote");}
  finally{setLoading(false)}
 }
 async function enroll(paymentToken){
  if(!quote||!requestKey||!catalog.checkoutEnabled)return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/autolikes/enroll",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({platform,serviceId,profile,quantityPerPost:Number(quantity),posts:Number(posts),
     delay:Number(delay),email,requestKey,dayOfMonth:Number(day),paymentToken,
     recurringConsent:consent,monitoringConsent:monitorConsent})});
   const body=await res.json();
   if(body.portalUrl)setPortal(body.portalUrl);
   setMessage(body.message||body.error||"Review your subscription status.");
   if(res.status===202||res.ok)setLocked(true);
  }catch{
   setMessage("Gateway response cannot be confirmed. Do not retry a charge; contact Litix support.");
   setLocked(true);
  }finally{setBusy(false)}
 }
 callback.current=enroll;
 useEffect(()=>{
  if(!quote||!catalog.checkoutEnabled||!publicKey||locked)return;
  let active=true;
  setCardReady(false);
  const script=document.createElement("script");
  script.id="litix-autolikes-collect";
  script.src="https://secure.nmi.com/token/Collect.js";
  script.async=true;
  script.setAttribute("data-tokenization-key",publicKey);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-style-sniffer","false");
  const configure=()=>{
   const api=getCollectJS();
   if(!active||!api?.configure)return;
   try{api.configure({variant:"inline",styleSniffer:false,
    fields:{ccnumber:{selector:"#ccnumber",title:"Card Number",placeholder:"Card number"},
      ccexp:{selector:"#ccexp",title:"Expiration",placeholder:"MM / YY"},
      cvv:{selector:"#cvv",title:"Security Code",placeholder:"CVV"}},
    callback:result=>{
     if(!active)return;
     if(result?.token)void callback.current?.(result.token);
     else{setMessage("Card tokenization could not be completed.");setBusy(false);}
    },
    fieldsAvailableCallback:()=>{if(active)setCardReady(true)}
   })}catch{if(active)setMessage("PayKings secure card fields could not initialize. No charge attempted.")}
  };
  script.onload=configure;
  script.onerror=()=>{if(active)setMessage("PayKings secure fields are unavailable. No charge attempted.")};
  document.head.appendChild(script);
  return()=>{active=false;script.remove();setCardReady(false)};
 },[quote,publicKey,catalog.checkoutEnabled,locked]);
 function submitCard(e){
  e.preventDefault();
  if(!quote||!cardReady||busy||locked||!consent||!monitorConsent||
   !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return;
  setBusy(true);
  try{getCollectJS()?.startPaymentRequest()}catch{
   setBusy(false);setMessage("Could not start secure payment. No charge submitted.");
  }
 }
 return <main className="wrap">
  <nav className="nav"><a className="brand" href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo"/></a>
   <div><a href="/shop">Shop</a><a href="/services">All Litix Services</a><a href="/track">Track Order</a></div></nav>
  <section className="panel" style={{maxWidth:940,margin:"32px auto"}}>
   <div className="kicker">LITIX · AUTOMATIC NEW-POST LIKES</div>
   <h1>AutoLikes subscriptions</h1>
   <p>Choose a public Instagram or TikTok profile, quantity per new post, and a fixed monthly post allowance.
    Litix verifies the live supplier service and monthly price before checkout. No account password required.</p>
   <p role="status">{catalog.loading?"Checking live AutoLikes availability...":catalog.note}</p>
   {!catalog.loading&&catalog.items.length>0&&<form onSubmit={requestQuote} style={{display:"grid",gap:16,marginTop:20}}>
    <label>Platform
     <select value={platform} disabled={busy||locked} onChange={e=>{setPlatform(e.target.value);setServiceId("");setQuote(null)}}>
      <option value="instagram">Instagram</option><option value="tiktok">TikTok</option>
     </select></label>
    <label>Verified AutoLikes service
     <select required value={serviceId} disabled={busy||locked} onChange={e=>{setServiceId(e.target.value);setQuote(null)}}>
      {available.length===0&&<option value="">No compatible active services</option>}
      {available.map(x=><option key={x.id} value={x.id}>{x.name} · {money(x.retailPer1000Cents)} / 1,000</option>)}
     </select></label>
    <label>Public profile username or direct profile link
     <input required value={profile} disabled={busy||locked} placeholder={platform==="instagram"?"@yourinstagram":"@yourtiktok"}
      onChange={e=>{setProfile(e.target.value);setQuote(null)}}/></label>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:15}}>
     <label>Likes per new post
      <input type="number" min={chosen?.minimum||1} max={chosen?.maximum||1000000} step="1"
       value={quantity} disabled={busy||locked} onChange={e=>{setQuantity(e.target.value);setQuote(null)}}/>
     </label>
     <label>New posts per month (1–30)
      <input type="number" min="1" max="30" step="1" value={posts} disabled={busy||locked}
       onChange={e=>{setPosts(e.target.value);setQuote(null)}}/>
     </label>
     <label>Start delay
      <select value={delay} disabled={busy||locked} onChange={e=>{setDelay(e.target.value);setQuote(null)}}>
       {delayChoices.map(x=><option key={x} value={x}>{x===0?"No delay":x+" minutes"}</option>)}
      </select></label>
    </div>
    <button type="submit" disabled={loading||!chosen||busy||locked}>{loading?"Verifying live price...":"Calculate verified monthly price"}</button>
   </form>}
   {!catalog.loading&&!catalog.items.length&&<p>No compatible supplier AutoLikes service is currently available. One-time services remain available in <a href="/shop">Litix Shop</a>.</p>}
   {quote&&<section className="panel" style={{marginTop:20}} aria-label="AutoLikes monthly quote">
    <h2>Verified monthly plan</h2>
    <p><strong>{money(quote.monthlyAmountCents)} per month</strong> · {Number(quote.likesPerPost).toLocaleString()} likes per new post · up to {quote.postsPerMonth} new posts each paid period.</p>
    <p>Automatically renews monthly until canceled. Charges are authorized by PayKings/NMI. Supplier delivery begins only after independently verified payment.
     A limited number of future posts are covered; unused monthly post allowances do not roll over. Actual delivery speed depends on service availability.</p>
    {catalog.checkoutEnabled&&publicKey&&!locked&&<form onSubmit={submitCard} style={{display:"grid",gap:14}}>
     <label>Checkout email <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
     <label>Monthly renewal day (1–28) <input type="number" min="1" max="28" required value={day} onChange={e=>setDay(e.target.value)} disabled={busy}/></label>
     <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/> I authorize recurring monthly payments of {money(quote.monthlyAmountCents)} until I cancel. I understand the new-post limit and billing terms.</label>
     <label><input type="checkbox" checked={monitorConsent} onChange={e=>setMonitorConsent(e.target.checked)} disabled={busy}/> I authorize this service to monitor newly published public posts for the selected profile during paid terms.</label>
     <PremiumInlineCheckout cardReady={cardReady} busy={busy} canPay={consent&&monitorConsent&&Boolean(email)}
      buttonLabel={busy?"Submitting securely...":"Start "+money(quote.monthlyAmountCents)+" monthly AutoLikes"}/>
    </form>}
    {!catalog.checkoutEnabled&&<p role="status"><strong>Monthly enrollment is not accepting payments yet.</strong> The supplier service and its pricing are verified, but recurring gateway approval and settlement safeguards must be enabled before customers can subscribe. No charge is attempted.</p>}
    {catalog.checkoutEnabled&&!publicKey&&<p>Secure PayKings card fields are unavailable. No charge attempted.</p>}
    {portal&&<p><a href={portal} rel="noreferrer">Manage your subscription request</a> · Save the link securely.</p>}
   </section>}
   {message&&<div className="msg" role="status">{message}</div>}
   <p className="small">Litix never asks for a social media password. Recurring billing and delivery are subject to confirmed payment and service eligibility.
    <a href="mailto:litixsocial@gmail.com"> Contact Litix support</a> for billing or delivery questions.</p>
  </section>
 </main>;
}
