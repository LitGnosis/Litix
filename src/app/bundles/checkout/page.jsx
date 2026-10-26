"use client";
import {useEffect,useRef,useState} from "react";
import {growthBundle,BUNDLE_INSTRUCTIONS} from "../../../lib/growthBundles.mjs";
const money=c=>"$"+(c/100).toFixed(2);
const collect=()=>{try{if(typeof CollectJS!=="undefined")return CollectJS}catch{}return typeof window!=="undefined"?window.CollectJS:null;};
export default function BundleCheckout(){
 const [pkgId,setPkgId]=useState("ig_launch"),[catalog,setCatalog]=useState(null),[email,setEmail]=useState(""),[profile,setProfile]=useState(""),
 [consent,setConsent]=useState(false),[cardReady,setCardReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const idem=useRef(""),submitted=useRef(false),onToken=useRef(null);
 const pkg=growthBundle(pkgId);
 useEffect(()=>{const id=new URLSearchParams(location.search).get("package");if(growthBundle(id))setPkgId(id);idem.current=crypto.randomUUID();fetch("/api/bundles",{cache:"no-store"}).then(r=>r.json()).then(setCatalog).catch(()=>setNotice("Bundle checkout availability could not be checked."))},[]);
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
 return <main className="wrap"><nav className="nav"><a href="/" className="brand">LITIX</a><a href="/bundles">Growth Bundles</a></nav>
  <section className="panel" style={{maxWidth:730,margin:"25px auto"}}>
   <span className="kicker">LITIX GROWTH BUNDLES</span><h1>Purchase Bundle</h1>
   <label>Choose package<select value={pkgId} onChange={e=>{setPkgId(e.target.value);submitted.current=false;idem.current=crypto.randomUUID()}}>
    {["Instagram","TikTok"].map(p=><optgroup key={p} label={p}>{["Launch","Momentum","Power","Apex"].map(t=>{const id=(p==="Instagram"?"ig":"tt")+"_"+t.toLowerCase();return <option key={id} value={id}>{p} {t} — {money(growthBundle(id).priceCents)}</option>})}</optgroup>)}
   </select></label>
   <h2>{pkg?.name} · {pkg&&money(pkg.priceCents)}</h2>
   <p className="small">Fixed-price package totals. Submit up to 10 posts, not 10 copies of each service.</p>
   <div className="lg-bundle-items">{pkg&&Object.entries(pkg.items).map(([kind,n])=><div key={kind}><span>{kind}</span><strong>{n.toLocaleString()}</strong></div>)}</div>
   <p className="lg-bundle-warning">{BUNDLE_INSTRUCTIONS}</p>
   <p className="small">After PayKings approves your one-time payment, you MUST tap the WhatsApp button on the confirmation page and message LITIX your order number plus up to 10 post links or screenshots. I personally arrange fulfillment; there is no automated supplier dispatch.</p>
   <form onSubmit={submit} className="form">
    <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>{pkg?.platform} username or public profile URL<input required value={profile} onChange={e=>setProfile(e.target.value)} placeholder="@yourprofile" autoCapitalize="none" autoCorrect="off"/></label>
    <label style={{display:"flex",alignItems:"start",gap:10,fontSize:14,lineHeight:1.5}}><input style={{width:20,marginTop:3}} type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I understand that WhatsApp post submission is mandatory, no more than 10 posts may be submitted, quantities are distributed across those posts, and all fulfillment requires manual LITIX approval.</span></label>
    {catalog?.checkoutEnabled?<><div><label>Card number<div id="bundle-ccnumber" className="field"/></label><div className="premium-card-row"><label>Expiration<div id="bundle-ccexp" className="field"/></label><label>CVV<div id="bundle-cvv" className="field"/></label></div></div><button className="pay" disabled={!cardReady||!consent||busy||submitted.current}>{busy?"Processing securely...":"Pay "+money(pkg.priceCents)+" with PayKings"}</button></>:
      <div role="status" className="lg-bundle-warning"><strong>Bundle checkout is not yet available.</strong> Live payment fields are unavailable. Check your connection and try again; no payment can be submitted until the secure gateway and official WhatsApp contact are available.</div>}
   </form>{notice&&<p role="status" className="msg">{notice}</p>}
   <p className="small">Ordinary one-time Litix orders remain available at <a href="/#checkout">regular checkout</a>.</p>
  </section></main>
}
