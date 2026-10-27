"use client";
import {useEffect,useRef,useState} from "react";
import {growthBundle,BUNDLE_INSTRUCTIONS} from "../../../lib/growthBundles.mjs";
import {normalizeOrderPhone} from "../../../lib/bundlePhone.mjs";
import {bluevineBundleLink} from "../../../lib/bluevineBundles.mjs";
const money=c=>"$"+(c/100).toFixed(2);
const collect=()=>{try{if(typeof CollectJS!=="undefined")return CollectJS}catch{}return typeof window!=="undefined"?window.CollectJS:null;};
export default function BundleCheckout(){
 const [pkgId,setPkgId]=useState("ig_launch"),[catalog,setCatalog]=useState(null),[email,setEmail]=useState(""),[profile,setProfile]=useState(""),
 [consent,setConsent]=useState(false),[cardReady,setCardReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [phone,setPhone]=useState(""),[smsConsent,setSmsConsent]=useState(false),[bluevineBusy,setBluevineBusy]=useState(false),[pendingBluevine,setPendingBluevine]=useState(null);
 const bluevineIdem=useRef(null);
 const idem=useRef(""),submitted=useRef(false),onToken=useRef(null);
 const pkg=growthBundle(pkgId);
 useEffect(()=>{const id=new URLSearchParams(location.search).get("package");if(growthBundle(id))setPkgId(id);idem.current=crypto.randomUUID();fetch("/api/bundles",{cache:"no-store"}).then(r=>r.json()).then(setCatalog).catch(()=>setNotice("Bundle checkout availability could not be checked."));
  try{const prev=JSON.parse(sessionStorage.getItem("litix:bundle-bluevine-pending")||"null");if(prev?.id&&prev?.packageId)setPendingBluevine(prev);}catch{}
 },[]);
 useEffect(()=>{
  if(!catalog?.checkoutEnabled||!catalog.publicKey)return;
  let active=true,timeout;
  const script=document.createElement("script");
  script.src="https://secure.nmi.com/token/Collect.js";
  script.async=true;script.id="litix-bundle-collect";
  script.setAttribute("data-tokenization-key",catalog.publicKey);
  script.setAttribute("data-variant","inline");
  script.setAttribute("data-style-sniffer","false");
  const init=()=>{
   if(!active||!collect()?.configure)return;
   try{collect().configure({
    variant:"inline",styleSniffer:false,
    fields:{
     ccnumber:{selector:"#bundle-ccnumber",title:"Card Number",placeholder:"Card number"},
     ccexp:{selector:"#bundle-ccexp",title:"Expiration Date",placeholder:"MM / YY"},
     cvv:{selector:"#bundle-cvv",title:"Security Code",placeholder:"CVV"}
    },
    callback:result=>{if(active){if(result?.token)onToken.current?.(result.token);else{setBusy(false);setNotice("Secure payment token unavailable.")}}},
    fieldsAvailableCallback:()=>{if(active){setCardReady(true);setNotice("")}}
   })}catch{if(active)setNotice("Secure PayKings fields could not initialize.")}
  };
  script.onload=init;script.onerror=()=>active&&setNotice("Secure PayKings fields did not load.");
  document.head.appendChild(script);timeout=setTimeout(()=>{if(active&&!collect()?.configure)setNotice("Secure fields unavailable. Please retry later.")},15000);
  return()=>{active=false;clearTimeout(timeout);script.remove()};
 },[catalog?.checkoutEnabled,catalog?.publicKey,pkgId]);
 onToken.current=async token=>{
  if(submitted.current||!pkg||!catalog?.checkoutEnabled||!consent||!token)return;
  submitted.current=true;
  try{
   const r=await fetch("/api/bundles/checkout",{method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({packageId:pkg.id,expectedAmountCents:pkg.priceCents,email,profile,whatsappConsent:consent,paymentToken:token,idempotencyKey:idem.current})});
   const data=await r.json();
   if(data.orderId&&data.trackingToken){
    sessionStorage.setItem("litix:bundle-confirmation",JSON.stringify({id:data.orderId,token:data.trackingToken}));
    location.assign("/bundles/confirmation?id="+encodeURIComponent(data.orderId));return;
   }
   setNotice(data.error||"Payment was not completed. Contact support before retrying.");
  }catch{setNotice("Payment outcome unknown. Do not repeat this purchase; contact Litix.")}
  finally{setBusy(false)}
 };
 function submit(e){
  e.preventDefault();
  if(!catalog?.checkoutEnabled||!cardReady||!pkg||!consent||busy||submitted.current)return;
  setBusy(true);setNotice("");
  try{collect().startPaymentRequest()}catch{setBusy(false);setNotice("Check your secure card fields.")}
 }
 async function beginBluevine(e){
  e.preventDefault();
  if(!pkg||!catalog?.bluevineEnabled||bluevineBusy)return;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||!/^[\w.@:/-]{2,150}$/.test(profile.trim())||
   !normalizeOrderPhone(phone)||!consent){setNotice("Enter a valid email, account name, and mobile phone number with country code, and accept the order terms.");return;}
  if(!bluevineIdem.current||bluevineIdem.current.packageId!==pkg.id)bluevineIdem.current={packageId:pkg.id,key:crypto.randomUUID()};
  setBluevineBusy(true);setNotice("");
  try{
   const r=await fetch("/api/bundles/bluevine",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({packageId:pkg.id,expectedAmountCents:pkg.priceCents,email,profile,phone,smsConsent,whatsappConsent:consent,idempotencyKey:bluevineIdem.current.key})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Pending Bluevine order could not be saved.");
   if(!d.orderId||!d.trackingToken||d.checkoutUrl!==bluevineBundleLink(pkg))throw Error("Payment link validation failed. No redirect made.");
   const tracking={id:d.orderId,token:d.trackingToken};
   const pending={...tracking,packageId:pkg.id};
   sessionStorage.setItem("litix:bundle-confirmation",JSON.stringify(tracking));
   sessionStorage.setItem("litix:bundle-bluevine-pending",JSON.stringify(pending));
   setPendingBluevine(pending);
   setNotice("Your LITIX order "+d.orderId+" has been placed and saved as AWAITING PAYMENT VERIFICATION. Opening Bluevine now. Your private tracking link is also being emailed.");
   // Payment remains UNPAID until an administrator verifies the transaction in Bluevine.
   location.assign(d.checkoutUrl);
  }catch(err){setNotice(err.message||"Bluevine checkout unavailable. No payment was initiated.");setBluevineBusy(false);}
 }
 return <main className="wrap"><nav className="nav"><a href="/" className="brand">LITIX</a><a href="/bundles">Growth Bundles</a></nav>
  <section className="panel" style={{maxWidth:730,margin:"25px auto"}}>
   <span className="kicker">LITIX GROWTH BUNDLES</span><h1>Purchase Bundle</h1>
   <label>Choose package<select value={pkgId} onChange={e=>{setPkgId(e.target.value);submitted.current=false;idem.current=crypto.randomUUID()}}>
    {["Instagram","TikTok"].map(p=><optgroup key={p} label={p}>{["Launch","Momentum","Power","Apex"].map(t=>{const id=(p==="Instagram"?"ig":"tt")+"_"+t.toLowerCase();return <option key={id} value={id}>{p} {t} — {money(growthBundle(id).priceCents)}</option>})}</optgroup>)}
   </select></label>
   <h2>{pkg?.name} · {pkg&&money(pkg.priceCents)}</h2>
   <p className="small">Fixed-price package totals. Likes, Views and Shares can be allocated across up to 10 posts. Followers are delivered once to your selected account.</p>
   <div className="lg-bundle-items">{pkg&&Object.entries(pkg.items).map(([kind,n])=><div key={kind}><span>{kind}</span><strong>{n.toLocaleString()}</strong></div>)}</div>
   <p className="lg-bundle-warning">{BUNDLE_INSTRUCTIONS}</p>
   <p className="small">After PayKings approves your one-time payment, send LITIX your order number and up to 10 post links or screenshots using the submission options on your confirmation page. I personally arrange fulfillment; there is no automated supplier dispatch.</p>
   <form onSubmit={submit} className="form">
    <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>{pkg?.platform} username or public profile URL<input required value={profile} onChange={e=>setProfile(e.target.value)} placeholder="@yourprofile" autoCapitalize="none" autoCorrect="off"/></label>
    <label style={{display:"flex",alignItems:"start",gap:10,fontSize:14,lineHeight:1.5}}><input style={{width:20,marginTop:3}} type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I understand that I must submit my order information via WhatsApp, email, or Instagram. I may submit up to 10 posts, and all fulfillment requires manual LITIX approval.</span></label>
    {catalog?.checkoutEnabled?<><div><label>Card number<div id="bundle-ccnumber" className="field"/></label><div className="premium-card-row"><label>Expiration<div id="bundle-ccexp" className="field"/></label><label>CVV<div id="bundle-cvv" className="field"/></label></div></div><button className="pay" disabled={!cardReady||!consent||busy||submitted.current}>{busy?"Processing securely...":"Pay "+money(pkg.priceCents)+" with PayKings"}</button></>:
      <div role="status" className="lg-bundle-warning"><strong>Bundle checkout is not yet available.</strong> Live payment fields are unavailable. Check your connection and try again; no payment can be submitted until the secure gateway and official WhatsApp contact are available.</div>}
   </form>
   {catalog?.bluevineEnabled?<section aria-label="Bluevine payment option" className="lg-bluevine-checkout">
    <h3>Pay with Bluevine — {pkg&&money(pkg.priceCents)}</h3>
    <p className="small">Alternative payment method. Your bundle and price stay the same. Enter your email and Instagram/TikTok account above, then your regular phone number below. A WhatsApp account is not required. Your pending order will be saved before you are redirected.</p>
    <form onSubmit={beginBluevine} className="form">
     <label>Phone Number (for Order Confirmation)<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 214 555 0100" autoComplete="tel" inputMode="tel" aria-describedby="phone-help"/></label>
     <p id="phone-help" className="small">United States: enter 10 digits or +1. Other countries: include the +country code. This is a regular mobile number, not a WhatsApp requirement.</p>
     <label style={{display:"flex",alignItems:"start",gap:10,fontSize:13}}><input type="checkbox" style={{width:20,marginTop:3}} checked={smsConsent} onChange={e=>setSmsConsent(e.target.checked)}/><span>Optional: I agree to receive transactional SMS updates about this LITIX order at my mobile number. Message and data rates may apply. Consent is not required to purchase.</span></label>
     <p className="small">Order confirmation is sent by email. SMS is sent only when our verified messaging service is enabled. You may submit order details through WhatsApp, email, or Instagram.</p>
     <p className="lg-bundle-warning">After payment, return to Litix and send your order number, receipt, and up to 10 post links or screenshots through WhatsApp, email, or Instagram. Bluevine does not automatically confirm your payment to this website. Fulfillment stays on hold until LITIX verifies it in Bluevine.</p>
     <button className="pay" type="submit" disabled={!consent||bluevineBusy}>{bluevineBusy?"Saving pending order...":"Pay with Bluevine — "+money(pkg.priceCents)}</button>
    </form>
   </section>:null}
   {pendingBluevine?<p className="small">Already visited Bluevine? <a href={"/bundles/confirmation?id="+encodeURIComponent(pendingBluevine.id)}>View your saved order and all three submission options</a>. Payment remains pending until manually confirmed.</p>:null}
   {notice&&<p role="status" className="msg">{notice}</p>}
   <p className="small">Ordinary one-time Litix orders remain available at <a href="/#checkout">regular checkout</a>.</p>
  </section></main>
}
