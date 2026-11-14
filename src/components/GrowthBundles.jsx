"use client";
import {useEffect,useState} from "react";
import {GROWTH_BUNDLES,BUNDLE_INSTRUCTIONS,growthBundle} from "../lib/growthBundles.mjs";
const fmt=n=>new Intl.NumberFormat("en-US").format(n);
const currency=n=>"$"+(n/100).toFixed(2);
const tiers=["Launch","Momentum","Power","Apex"];

export default function GrowthBundles({standalone=false}){
 const [platform,setPlatform]=useState("Instagram");
 const [tier,setTier]=useState("Launch");
 const [bluevineEnabled,setBluevineEnabled]=useState(false);
 const [checking,setChecking]=useState(false);
 const [checkoutNotice,setCheckoutNotice]=useState("");
 const [autoAvailable,setAutoAvailable]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(false);
 useEffect(()=>{
  const selected=growthBundle(new URLSearchParams(location.search).get("package"));
  if(selected){setPlatform(selected.platform);setTier(selected.tier)}
  fetch("/api/bundles",{cache:"no-store"})
   .then(r=>r.json())
   .then(d=>{setBluevineEnabled(d.bluevineEnabled===true);setAutoAvailable(d.autoFulfillmentEnabled===true)})
   .catch(()=>{setBluevineEnabled(false);setAutoAvailable(false)});
 },[]);
 const p=GROWTH_BUNDLES.find(x=>x.platform===platform&&x.tier===tier);
 async function continueCheckout(){
  if(checking||!p)return;
  setChecking(true);setCheckoutNotice("");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await fetch("/api/bundles",{cache:"no-store",signal:controller.signal});
   if(!response.ok)throw Error("readiness_unavailable");
   const data=await response.json();
   if(data.checkoutEnabled===true){
    window.location.assign("/bundles/checkout?package="+encodeURIComponent(p.id)+"&method=paykings");
    return;
   }
   setCheckoutNotice("Secure card checkout is not ready for this bundle. No charge was attempted. Contact our concierge or try the readiness check again.");
  }catch{
   setCheckoutNotice("We could not confirm secure checkout readiness. No charge was attempted. Try again or contact the Litix concierge.");
  }finally{clearTimeout(timer);setChecking(false)}
 }
 return <section id="growth-bundles" className="lg-bundles panel lg-bundles-compact" aria-label="Litix Growth Bundles">
  <div className="lg-bundles-heading">
   <div><span className="kicker">LITIX · FIXED-PRICE PACKAGES</span>
    <h2>Growth Bundles</h2>
    <p>Four packages. One simple dropdown. Choose your platform and see exactly what is included before paying.</p>
   </div>
   <span className="lg-bundles-seal">{autoAvailable?"DIRECT FULFILLMENT ENABLED":"CURATED MULTI-POST BUNDLE"}</span>
  </div>
  <div className="lg-bundles-picker">
   <div className="lg-bundles-tabs" role="group" aria-label="Growth bundle platform">
    {["Instagram","TikTok"].map(value=><button type="button" key={value}
     className={platform===value?"lg-tab active":"lg-tab"}
     aria-pressed={platform===value} onClick={()=>setPlatform(value)}>{value}</button>)}
   </div>
   <label htmlFor="litix-bundle-select">Choose your package
    <select id="litix-bundle-select" value={tier} onChange={e=>{setTier(e.target.value);setDetailsOpen(false)}}>
     {tiers.map(name=>{
      const entry=GROWTH_BUNDLES.find(x=>x.platform===platform&&x.tier===name);
      return <option key={name} value={name}>{name} · {currency(entry.priceCents)}</option>;
     })}
    </select>
   </label>
  </div>
  <div className="lg-bundles-selected" aria-live="polite">
   <div className="lg-bundle-summary">
    <div><span className="kicker">{platform.toUpperCase()} · {tier.toUpperCase()}</span>
     <h3>{p.name}</h3>
     <p>Includes Likes, Views, Shares and Followers. Up to 10 posts; followers go to one account.</p>
    </div>
    <strong className="lg-price">{currency(p.priceCents)}</strong>
   </div>
   <dl className="lg-bundle-items">{Object.entries(p.items).map(([kind,quantity])=>
    <div key={kind}><dt>{kind}</dt><dd>{fmt(quantity)}</dd></div>)}</dl>
   <button type="button" className="lg-bundle-details-toggle" aria-expanded={detailsOpen}
     aria-controls="lg-bundle-delivery-details" onClick={()=>setDetailsOpen(x=>!x)}>
     {detailsOpen?"Hide delivery details":"Read delivery & refill details"}
     <span aria-hidden="true">{detailsOpen?"−":"+"}</span>
   </button>
   {detailsOpen&&<div id="lg-bundle-delivery-details" className="lg-bundle-warning">
    <p>{autoAvailable?
     "Eligible PayKings bundles can automatically distribute one verified paid order across approved selected posts, with each delivery component tracked separately. Bluevine orders are verified separately.":
     BUNDLE_INSTRUCTIONS}</p>
    <p>Refill eligibility varies by service and is never guaranteed. Every purchase is checked before fulfillment.</p>
   </div>}
   <div className="lg-bundle-actions">
    <button className="lg-bundle-buy" type="button" disabled={checking}
      onClick={continueCheckout} aria-busy={checking}>
      {checking?"Checking secure checkout…":"Continue to Secure Checkout · "+currency(p.priceCents)}
    </button>
    {checkoutNotice&&<div className="lg-bundle-warning" role="status" aria-live="polite">
      <p>{checkoutNotice}</p>
      <button type="button" className="alt" disabled={checking} onClick={continueCheckout}>Retry secure checkout</button>
      <a href={"https://wa.me/19452106315?text="+encodeURIComponent("Hello LITIX Concierge, please help me with "+p.name+" ("+currency(p.priceCents)+"). I will not send card information in chat.")} target="_blank" rel="noopener noreferrer">WhatsApp Concierge</a>
      <a href={"/bundles/checkout?package="+encodeURIComponent(p.id)}>Review package details</a>
    </div>}
    {bluevineEnabled?<a className="lg-bundle-bluevine" href={"/bundles/checkout?package="+encodeURIComponent(p.id)+"&method=bluevine"}>Pay with Bluevine</a>:null}
    <a href={"/bundles?package="+encodeURIComponent(p.id)+"#growth-bundles"}>See package in full</a>
   </div>
  </div>
  <p className="lg-bundles-note">One clear price for the entire package. Secure payment and delivery eligibility are verified before processing. Keep your Litix order number for tracking.</p>
  {standalone&&<div className="lg-bundle-actions lg-bundle-support" aria-label="Bundle support">
   <a href="https://wa.me/19452106315" target="_blank" rel="noopener noreferrer">Manual order via WhatsApp</a>
   <a href="mailto:Litixsocial@gmail.com?subject=Litix%20Manual%20Bundle">Email Litix Support</a>
  </div>}
 </section>;
}
