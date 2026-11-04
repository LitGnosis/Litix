"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import PremiumInlineCheckout from "../../components/PremiumInlineCheckout";
import {maySubmitPrepaidToken} from "../../lib/litixAutoLikesCheckoutGate.mjs";
const dollars=c=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(c||0)/100);
const collect=()=>{try{if(typeof CollectJS!=="undefined")return CollectJS}catch{};return typeof window!=="undefined"?window.CollectJS:null};
export default function LitixAutoLikesPrepaid(){
 const [catalog,setCatalog]=useState({loading:true,platforms:[],checkoutEnabled:false});
 const [platform,setPlatform]=useState("instagram"),[tierId,setTierId]=useState("lite");
 const [profile,setProfile]=useState(""),[posts,setPosts]=useState("10");
 const [quote,setQuote]=useState(null),[requestKey,setRequestKey]=useState("");
 const [email,setEmail]=useState(""),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false);
 const [key,setKey]=useState(""),[cardReady,setCardReady]=useState(false);
 const [message,setMessage]=useState(""),[privateLink,setPrivateLink]=useState(""),[receipt,setReceipt]=useState(null);
 const [locked,setLocked]=useState(false);const paymentCallback=useRef(null);
 const [homeRedirect,setHomeRedirect]=useState(false);
 const homeTimer=useRef(null);
 useEffect(()=>()=>{if(homeTimer.current)clearTimeout(homeTimer.current)},[]);
 // Tokenization and gateway submission are separate phases. Busy UI state
 // must not cause the asynchronous Collect.js callback to be dropped.
 const tokenizationPending=useRef(false);
 const checkoutStarted=useRef(false);
 const tokenTimer=useRef(null);
 const clearTokenTimer=()=>{if(tokenTimer.current){clearTimeout(tokenTimer.current);tokenTimer.current=null}};
 useEffect(()=>()=>clearTokenTimer(),[]);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/autolikes/prepaid/catalog",{cache:"no-store",signal:controller.signal})
   .then(r=>r.json()).then(data=>{if(!controller.signal.aborted)setCatalog({
    loading:false,platforms:Array.isArray(data.platforms)?data.platforms:[],
    checkoutEnabled:data.checkoutEnabled===true,message:data.message||""})})
   .catch(()=>{if(!controller.signal.aborted)setCatalog({loading:false,platforms:[],checkoutEnabled:false,message:"Litix AutoLikes unavailable"})});
  fetch("/api/config",{cache:"no-store",signal:controller.signal}).then(r=>r.json()).then(data=>{
   if(!controller.signal.aborted&&data.ready&&data.publicKey)setKey(data.publicKey);
  }).catch(()=>{});
  return()=>controller.abort();
 },[]);
 const selectedPlatform=catalog.platforms.find(x=>x.platform===platform);
 const plans=selectedPlatform?.plans||[],chosen=plans.find(x=>x.id===tierId)||plans[0]||null;
 const edit=()=>{setQuote(null);setCardReady(false);setMessage("");setPrivateLink("");setReceipt(null)};
 useEffect(()=>{if(!plans.length)return;if(!plans.find(x=>x.id===tierId)){setTierId(plans[0].id);edit()}},[platform,catalog.platforms]);
 async function calculate(e){
  e.preventDefault();if(!chosen||busy)return;setBusy(true);setMessage("");setQuote(null);
  try{
   const res=await fetch("/api/autolikes/prepaid/quote",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({platform,profile,tierId:chosen.id,posts:Number(posts)})});
   const body=await res.json();
   if(!res.ok)throw Error(body.error||"Unable to verify price");
   setQuote(body.quote);setRequestKey(crypto.randomUUID());
  }catch(e){setMessage(e.message||"Please verify your profile and plan.")}finally{setBusy(false)}
 }
 async function pay(paymentToken){
  if(!maySubmitPrepaidToken({quote,requestKey,checkoutEnabled:catalog.checkoutEnabled,
   locked,checkoutStarted:checkoutStarted.current})||!tokenizationPending.current)return;
  // Claim the request before await; Collect.js may call back more than once.
  checkoutStarted.current=true;
  tokenizationPending.current=false;
  clearTokenTimer();
  setBusy(true);setMessage("Checking the payment securely. Do not submit another payment.");
  try{
   const res=await fetch("/api/autolikes/prepaid/checkout",{
    method:"POST",headers:{"content-type":"application/json"},signal:AbortSignal.timeout(70000),
    body:JSON.stringify({platform,profile,tierId:quote.plan,posts:quote.posts,
     expectedAmountCents:quote.amountCents,email,requestKey,paymentToken,
     singlePaymentConsent:true,monitoringConsent:consent})});
   const body=await res.json().catch(()=>({}));
   setMessage(body.message||body.error||"Payment response needs review. Do not submit another purchase until status is verified.");
   if(body.privateTrackingUrl)setPrivateLink(body.privateTrackingUrl);
   if(body.orderId)setReceipt({id:body.orderId,payment:body.payment||"review",amount:body.amountCents});
   // Redirect ONLY a confirmed paid order with a private tracking link.
   // Do not redirect a declined or uncertain payment; they require review.
   if(body.payment==="paid"&&body.orderId&&body.privateTrackingUrl){
    setHomeRedirect(true);
    if(homeTimer.current)clearTimeout(homeTimer.current);
    homeTimer.current=setTimeout(()=>window.location.assign("/?autolikes=confirmed"),10000);
   }
   // Token may already have reached the gateway even if a response is ambiguous.
   // Never re-submit it automatically or offer a second payment from this view.
   setLocked(true);
  }catch{
   setMessage("The payment response could not be confirmed. Do not retry; contact Litix support.");
   setLocked(true);
  }finally{setBusy(false)}
 }
 paymentCallback.current=pay;
 useEffect(()=>{
  if(!quote||!catalog.checkoutEnabled||!key||locked)return;
  let active=true,configured=false;let poll=null,timeout=null;
  setCardReady(false);
  const script=document.createElement("script");
  script.src="https://secure.nmi.com/token/Collect.js";script.id="litix-prepaid-collect";
  script.async=true;
  script.setAttribute("data-tokenization-key",key);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-style-sniffer","false");
  const setup=()=>{
   if(!active||configured)return;
   const api=collect();
   const present=["ccnumber","ccexp","cvv"].every(id=>document.getElementById(id));
   if(!api?.configure||!present)return;
   try{
    configured=true;
    api.configure({variant:"inline",styleSniffer:false,
     customCss:{"font-size":"16px","background-color":"transparent",color:"#ffffff"},
     fields:{ccnumber:{selector:"#ccnumber",title:"Card Number",placeholder:"Card number"},
      ccexp:{selector:"#ccexp",title:"Expiry",placeholder:"MM/YY"},
      cvv:{selector:"#cvv",title:"Security Code",placeholder:"CVV"}},
     callback:data=>{
      if(!active||!tokenizationPending.current)return;
      if(data?.token){clearTokenTimer();void paymentCallback.current?.(data.token)}
      else{tokenizationPending.current=false;clearTokenTimer();setBusy(false);
       setMessage("Secure card authorization failed before checkout submission. No purchase was requested.");}
     },
     fieldsAvailableCallback:()=>{if(active)setCardReady(true)}
    });
   }catch{if(active){setCardReady(false);setMessage("PayKings secure fields are unavailable. No payment attempted.")}}
  };
  script.onload=()=>{setup();poll=setInterval(setup,200)};
  script.onerror=()=>{if(active)setMessage("Secure payment fields failed to load.")};
  document.head.appendChild(script);
  timeout=setTimeout(()=>{if(active&&!configured)setMessage("Secure payment fields are not ready. Refresh to retry.")},15000);
  return()=>{active=false;script.remove();if(poll)clearInterval(poll);if(timeout)clearTimeout(timeout);setCardReady(false)};
 },[quote,locked,catalog.checkoutEnabled,key]);
 function submitCard(e){
  e.preventDefault();
  if(!cardReady||busy||locked||!consent||!email||!quote||
   tokenizationPending.current||checkoutStarted.current)return;
  const api=collect();
  if(typeof api?.startPaymentRequest!=="function"){
   setMessage("Secure card fields are not ready; no checkout was submitted.");return;
  }
  tokenizationPending.current=true;
  setBusy(true);
  setMessage("Securely authorizing your card. Please do not click Pay again.");
  clearTokenTimer();
  tokenTimer.current=setTimeout(()=>{
   if(!tokenizationPending.current||checkoutStarted.current)return;
   tokenizationPending.current=false;
   tokenTimer.current=null;
   setBusy(false);
   setMessage("Secure card fields did not return an authorization. No Litix checkout request was sent by this page. Check for a previous charge before trying again.");
  },20000);
  try{api.startPaymentRequest()}catch{
   tokenizationPending.current=false;clearTokenTimer();setBusy(false);
   setMessage("Secure payment could not start. No Litix checkout request was sent.");
  }
 }
 return <main className="wrap">
  <nav className="nav"><a className="brand" href="/" aria-label="Litix home">
   <img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo"/></a>
   <div><a href="/shop">Shop</a><a href="/services">All Litix Services</a><a href="/track">Track Order</a></div>
  </nav>
  <section className="panel" style={{maxWidth:920,margin:"32px auto"}}>
   <div className="kicker">LITIX AUTO LIKES · ONE-TIME PAYMENT</div>
   <h1>Automatic Likes for Your Next Posts</h1>
   <p>Pick Instagram or TikTok, choose likes per new post, and prepay for up to 10 posts within 30 days.
    No monthly subscription, no automatic renewal, no social-account password.</p>
   <p role="status">{catalog.loading?"Checking live Litix services…":catalog.message}</p>
   {!catalog.loading&&catalog.platforms.length>0&&
   <form onSubmit={calculate} style={{display:"grid",gap:16,marginTop:22}}>
    <label>Platform
     <select value={platform} disabled={busy||locked} onChange={e=>{setPlatform(e.target.value);setTierId("lite");edit()}}>
      {catalog.platforms.map(p=><option value={p.platform} key={p.platform}>{p.label}</option>)}
     </select>
    </label>
    <label>Likes per new post
     <select value={chosen?.id||""} disabled={busy||locked} onChange={e=>{setTierId(e.target.value);edit()}}>
      {plans.map(p=><option key={p.id} value={p.id}>{p.likesPerPost.toLocaleString()} likes/post — up to 10 posts: {dollars(p.priceForTenPostsCents)}</option>)}
     </select>
    </label>
    <label>Public profile username or profile link
     <input required value={profile} disabled={busy||locked} onChange={e=>{setProfile(e.target.value);edit()}}
      placeholder={platform==="instagram"?"@yourinstagram":"@yourtiktok"} autoComplete="off"/>
    </label>
    <label>How many new posts to cover (1–10)
     <input required type="number" inputMode="numeric" min="1" max="10" step="1" value={posts}
      disabled={busy||locked} onChange={e=>{setPosts(e.target.value);edit()}}/>
    </label>
    <button type="submit" disabled={!chosen||busy||locked}>{busy?"Verifying price…":"Review secure one-time price"}</button>
   </form>}
   {!catalog.loading&&catalog.platforms.length===0&&<p>AutoLikes is currently unavailable. Existing one-time services remain accessible at <a href="/shop">Litix Shop</a>.</p>}
   {quote&&<section className="panel" style={{marginTop:24}}>
    <h2>One-time package</h2>
    <p><strong>{dollars(quote.amountCents)} total</strong> — {quote.likesPerPost.toLocaleString()} likes per new post,
     up to {quote.posts} new posts over 30 days.</p>
    <p className="small">One payment only; nothing renews automatically. Only future public posts count.
     The package expires after 30 days or after the selected post allowance is used. Delivery speed and availability vary.
     Artificial engagement may violate social platforms' policies.</p>
    {catalog.checkoutEnabled&&key&&!locked&&<form onSubmit={submitCard} style={{display:"grid",gap:12}}>
     <label>Confirmation email
      <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
     </label>
     <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/>
      I authorize one payment of {dollars(quote.amountCents)} and monitoring of new public posts on the selected profile for up to {quote.posts} posts/30 days.</label>
     <PremiumInlineCheckout cardReady={cardReady} busy={busy} canPay={Boolean(email)&&consent}
      buttonLabel={busy?"Processing…":"Pay "+dollars(quote.amountCents)+" once with PayKings"}/>
    </form>}
    {!catalog.checkoutEnabled&&<p role="status"><strong>Prepaid checkout is not enabled on this deployment.</strong> Pricing and profile selection are available without charging a card.</p>}
    {catalog.checkoutEnabled&&!key&&<p>PayKings secure checkout is temporarily unavailable. No charge attempted.</p>}
   </section>}
   {message&&<div className="msg" role="status">{message}</div>}
   {receipt&&<div className="panel" aria-label="AutoLikes order confirmation">
    <h2>{receipt.payment==="paid"?"Payment successful":"Order needs review"}</h2>
    <p>Litix order: <strong>{receipt.id}</strong></p>
    <p>Payment status: <strong>{receipt.payment}</strong></p>
    {receipt.payment==="paid"&&<p>Your payment confirmation and private order-tracking emails are being sent to the address you provided. Check your inbox and spam folder; contact support if they're missing.</p>}
    {privateLink&&<p><a href={privateLink} rel="noreferrer">Track your private AutoLikes order</a> · Keep this link private.</p>}
    {homeRedirect&&<p role="status">Returning to the Litix homepage automatically in about 10 seconds.</p>}
    <p><a className="primary" href="/">Return to Litix Home</a></p>
   </div>}
   <p className="small">No password is needed. Need help with an order? <a href="mailto:litixsocial@gmail.com">Contact Litix support</a>.</p>
  </section>
 </main>;
}
