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
 const [phone,setPhone]=useState(""),[smsConsent,setSmsConsent]=useState(false),[bluevineBusy,setBluevineBusy]=useState(false),[pendingBluevine,setPendingBluevine]=useState(null),[method,setMethod]=useState("paykings");
 const [autoMode,setAutoMode]=useState(false),[postLinks,setPostLinks]=useState(""),[gallery,setGallery]=useState([]),
 [galleryState,setGalleryState]=useState("idle");
 const selectedPostLinks=postLinks.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
 const autoSelected=method==="paykings"&&catalog?.autoFulfillmentEnabled===true&&autoMode;
 const bluevineIdem=useRef(null);
 const idem=useRef(""),submitted=useRef(false),onToken=useRef(null);
 const pkg=growthBundle(pkgId);
 useEffect(()=>{const params=new URLSearchParams(location.search),id=params.get("package");if(growthBundle(id))setPkgId(id);if(params.get("method")==="bluevine")setMethod("bluevine");idem.current=crypto.randomUUID();fetch("/api/bundles",{cache:"no-store"}).then(r=>r.json()).then(d=>{
   setCatalog(d);setAutoMode(d.autoFulfillmentEnabled===true);
  }).catch(()=>setNotice("Bundle checkout availability could not be checked."));
  try{const prev=JSON.parse(sessionStorage.getItem("litix:bundle-bluevine-pending")||"null");if(prev?.id&&prev?.packageId)setPendingBluevine(prev);}catch{}
 },[]);
 useEffect(()=>{
  if(!autoSelected||!profile.trim()){setGallery([]);setGalleryState("idle");return;}
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setGalleryState("loading");
   try{
    const platform=pkg?.platform?.toLowerCase();
    let input=profile.trim().replace(/^@/,"");
    if(input.startsWith("https://")){
     const u=new URL(input);input=platform==="instagram"?u.pathname.split("/")[1]:u.pathname.split("/")[1]?.replace(/^@/,"");
    }
    if(!/^[A-Za-z0-9._]{2,30}$/.test(input))throw Error("Enter your public username.");
    const r=await fetch("/api/post-picker?platform="+platform+"&username="+encodeURIComponent(input),{signal:controller.signal,cache:"no-store"});
    const data=await r.json();
    if(!r.ok)throw Error("Unable to retrieve public posts.");
    const items=Array.isArray(data.posts)?data.posts:[];
    setGallery(items);setGalleryState(items.length?"ready":"empty");
   }catch{if(!controller.signal.aborted){setGallery([]);setGalleryState("unavailable")}}
  },1200);
  return()=>{controller.abort();clearTimeout(timer)};
 },[autoSelected,profile,pkg?.platform]);
 const togglePost=url=>{
  setPostLinks(current=>{
   const urls=current.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
   const next=urls.includes(url)?urls.filter(x=>x!==url):urls.length<10?[...urls,url]:urls;
   return next.join("\\n");
  });
 };
 useEffect(()=>{
  if(method!=="paykings"||!catalog?.checkoutEnabled||!catalog.publicKey)return;
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
 },[method,catalog?.checkoutEnabled,catalog?.publicKey,pkgId]);
 onToken.current=async token=>{
  if(method!=="paykings"||submitted.current||bluevineBusy||pendingBluevine?.packageId===pkg?.id||!pkg||!catalog?.checkoutEnabled||!consent||!token)return;
  submitted.current=true;
  try{
   const r=await fetch("/api/bundles/checkout",{method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({packageId:pkg.id,expectedAmountCents:pkg.priceCents,email,profile,whatsappConsent:consent,paymentToken:token,idempotencyKey:idem.current,autoFulfill:autoSelected,postUrls:autoSelected?selectedPostLinks:[]})});
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
  if(method!=="paykings"||!catalog?.checkoutEnabled||!cardReady||!pkg||!consent||busy||bluevineBusy||submitted.current||pendingBluevine?.packageId===pkg.id)return;
  if(autoSelected&&(selectedPostLinks.length<1||selectedPostLinks.length>10)){setNotice("Select 1–10 public post links for automatic bundle delivery, or choose manual coordination.");return;}
  setBusy(true);setNotice("");
  try{collect().startPaymentRequest()}catch{setBusy(false);setNotice("Check your secure card fields.")}
 }
 async function beginBluevine(e){
  e.preventDefault();
  if(method!=="bluevine"||!pkg||!catalog?.bluevineEnabled||bluevineBusy||busy||submitted.current)return;
  if(pendingBluevine?.packageId===pkg.id){setNotice("This bundle already has a saved Bluevine order. Open its tracking page instead of starting another payment.");return;}
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
   <p className="lg-bundle-warning">{autoSelected
     ?"Choose up to 10 public posts. Likes, Views and Shares are split across your chosen posts; Followers go once to your profile. Litix verifies all supplier delivery parts and your fixed package price before processing one PayKings payment."
     :BUNDLE_INSTRUCTIONS}</p>
   <div className="lg-bundle-methods" role="group" aria-label="Choose bundle payment method">
     <button type="button" className={"lg-bundle-method"+(method==="paykings"?" active":"")} aria-pressed={method==="paykings"} disabled={!catalog?.checkoutEnabled||busy||bluevineBusy||submitted.current||pendingBluevine?.packageId===pkg?.id} onClick={()=>{setMethod("paykings");setNotice("")}}>Pay with PayKings</button>
     <button type="button" className={"lg-bundle-method"+(method==="bluevine"?" active":"")} aria-pressed={method==="bluevine"} disabled={!catalog?.bluevineEnabled||busy||bluevineBusy||submitted.current} onClick={()=>{setMethod("bluevine");setNotice("")}}>Pay with Bluevine</button>
    </div>
    {method==="paykings"&&<p className="small">PayKings processes a single one-time payment with secure card fields. {autoSelected?"After verified settlement, Litix submits separate delivery orders for each included service and post.":"After payment, submit your post links through the confirmation page for manual coordination."}</p>}
    {pendingBluevine?.packageId===pkg?.id?<p className="lg-bundle-warning" role="status">A Bluevine checkout has already been started for this bundle. To prevent duplicate payment, review that order before attempting PayKings. <a href={"/bundles/confirmation?id="+encodeURIComponent(pendingBluevine.id)}>Track existing order</a>.</p>:null}
   <form onSubmit={submit} className="form">
    <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>{pkg?.platform} username or public profile URL<input required value={profile} onChange={e=>setProfile(e.target.value)} placeholder="@yourprofile" autoCapitalize="none" autoCorrect="off"/></label>
    {method==="paykings"&&catalog?.autoFulfillmentEnabled&&<section aria-label="Automated bundle post selection" className="lg-bundle-auto-posts">
      <label style={{display:"flex",gap:10,alignItems:"center"}}>
       <input type="checkbox" style={{width:20}} checked={autoMode} onChange={e=>setAutoMode(e.target.checked)}/>
       <span><strong>Automatic post delivery</strong> (one payment; separate Litix tracking per service)</span>
      </label>
      {autoMode&&<>
       <p className="small">Enter your public profile above. Pick 1–10 posts below, or paste each direct post link on its own line. The fixed bundle totals are split across selected posts, not repeated on every post.</p>
       <p className="small" role="status">{galleryState==="loading"?"Loading public posts…":galleryState==="unavailable"?"Post thumbnails temporarily unavailable. Direct links still work.":galleryState==="empty"?"No public thumbnails found. Paste direct post links.":gallery.length?gallery.length+" posts ready to select":""}</p>
       {gallery.length>0&&<div className="lg-auto-gallery" role="group" aria-label="Select public posts">
        {gallery.map(p=><button key={p.url} type="button" aria-pressed={selectedPostLinks.includes(p.url)}
         onClick={()=>togglePost(p.url)} className={"lg-auto-thumb"+(selectedPostLinks.includes(p.url)?" selected":"")}>
         {p.thumbnail?<img src={p.thumbnail} alt="Public post thumbnail" loading="lazy"/>:<span>Post</span>}
         <span>{selectedPostLinks.includes(p.url)?"Selected":"Select post"}</span>
        </button>)}
       </div>}
       <label>Selected post links (one per line; maximum 10)
        <textarea rows={4} value={postLinks} onChange={e=>setPostLinks(e.target.value)} placeholder={pkg?.platform==="Instagram"?"https://www.instagram.com/p/...":"https://www.tiktok.com/@user/video/..."} autoCapitalize="none" spellCheck={false}/>
       </label>
       <p role="status" className="small">{selectedPostLinks.length} of 10 posts selected</p>
      </>}
     </section>}
    <label style={{display:"flex",alignItems:"start",gap:10,fontSize:14,lineHeight:1.5}}><input style={{width:20,marginTop:3}} type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{autoSelected?"I authorize Litix to process this fixed-price bundle as separate Boostero supplier deliveries after verified payment, with no repeated orders on uncertain outcomes.":"I understand that I must submit my order information via WhatsApp, email, or Instagram. I may submit up to 10 posts, and all fulfillment requires manual LITIX approval."}</span></label>
    {method==="paykings"&&catalog?.checkoutEnabled?<><div><label>Card number<div id="bundle-ccnumber" className="field"/></label><div className="premium-card-row"><label>Expiration<div id="bundle-ccexp" className="field"/></label><label>CVV<div id="bundle-cvv" className="field"/></label></div></div><button className="pay" disabled={!cardReady||!consent||busy||bluevineBusy||submitted.current||pendingBluevine?.packageId===pkg?.id}>{busy?"Processing securely...":"Pay with PayKings — "+money(pkg.priceCents)}</button></>:
      method==="paykings"?<div role="status" className="lg-bundle-warning"><strong>PayKings bundle checkout is unavailable until merchant activation.</strong> Live payment fields are unavailable. Check your connection and try again; no payment can be submitted until the secure gateway and official WhatsApp contact are available.</div>:null}
   </form>
   {method==="bluevine"&&catalog?.bluevineEnabled?<section aria-label="Bluevine payment option" className="lg-bluevine-checkout">
    <h3>Pay with Bluevine — {pkg&&money(pkg.priceCents)}</h3>
    <p className="small">Alternative payment method. Your bundle and price stay the same. Enter your email and Instagram/TikTok account above, then your regular phone number below. A WhatsApp account is not required. Your pending order will be saved before you are redirected.</p>
    <form onSubmit={beginBluevine} className="form">
     <label>Phone Number (for Order Confirmation)<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 214 555 0100" autoComplete="tel" inputMode="tel" aria-describedby="phone-help"/></label>
     <p id="phone-help" className="small">United States: enter 10 digits or +1. Other countries: include the +country code. This is a regular mobile number, not a WhatsApp requirement.</p>
     <label style={{display:"flex",alignItems:"start",gap:10,fontSize:13}}><input type="checkbox" style={{width:20,marginTop:3}} checked={smsConsent} onChange={e=>setSmsConsent(e.target.checked)}/><span>Optional: I agree to receive transactional SMS updates about this LITIX order at my mobile number. Message and data rates may apply. Consent is not required to purchase.</span></label>
     <p className="small">Order confirmation is sent by email. SMS is sent only when our verified messaging service is enabled. You may submit order details through WhatsApp, email, or Instagram.</p>
     <p className="lg-bundle-warning">After payment, return to Litix and send your order number, receipt, and up to 10 post links or screenshots through WhatsApp, email, or Instagram. Bluevine does not automatically confirm your payment to this website. Fulfillment stays on hold until LITIX verifies it in Bluevine.</p>
     <button className="pay" type="submit" disabled={!consent||bluevineBusy||busy||submitted.current||pendingBluevine?.packageId===pkg?.id}>{bluevineBusy?"Saving pending order...":"Pay with Bluevine — "+money(pkg.priceCents)}</button>
    </form>
   </section>:null}
   {pendingBluevine?<p className="small">Already visited Bluevine? <a href={"/bundles/confirmation?id="+encodeURIComponent(pendingBluevine.id)}>View your saved order and all three submission options</a>. Payment remains pending until manually confirmed.</p>:null}
   {notice&&<p role="status" className="msg">{notice}</p>}
   <p className="small">Ordinary one-time Litix orders remain available at <a href="/#checkout">regular checkout</a>.</p>
  </section></main>
}
