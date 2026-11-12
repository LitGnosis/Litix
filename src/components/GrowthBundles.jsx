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
 const [payKingsEnabled,setPayKingsEnabled]=useState(false);
 const [autoAvailable,setAutoAvailable]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(false);
 useEffect(()=>{
  const selected=growthBundle(new URLSearchParams(location.search).get("package"));
  if(selected){setPlatform(selected.platform);setTier(selected.tier)}
  fetch("/api/bundles",{cache:"no-store"})
   .then(r=>r.json())
   .then(d=>{setBluevineEnabled(d.bluevineEnabled===true);setPayKingsEnabled(d.checkoutEnabled===true);setAutoAvailable(d.autoFulfillmentEnabled===true)})
   .catch(()=>{setBluevineEnabled(false);setPayKingsEnabled(false);setAutoAvailable(false)});
 },[]);
 const p=GROWTH_BUNDLES.find(x=>x.platform===platform&&x.tier===tier);
 return <section id="growth-bundles" className="lg-bundles panel lg-bundles-compact" aria-label="Litix Growth Bundles">
  <div className="lg-bundles-heading">
   <div><span className="kicker">LITIX · FIXED-PRICE PACKAGES</span>
    <h2>Growth Bundles</h2>
    <p>Four packages. One simple dropdown. Choose your platform and see exactly what is included before paying.</p>
   </div>
   <span className="lg-bundles-seal">{autoAvailable?"AUTO DELIVERY AVAILABLE":"MANUALLY COORDINATED"}</span>
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
     "Eligible PayKings bundles can automatically distribute one verified paid order across approved selected posts, with each supplier child tracked separately. Bluevine remains manually coordinated.":
     BUNDLE_INSTRUCTIONS}</p>
    <p>Refills are supplier-dependent; no refill is guaranteed. Availability and dispatch are checked before fulfillment.</p>
   </div>}
   <div className="lg-bundle-actions">
    {payKingsEnabled?<a className="lg-bundle-buy" href={"/bundles/checkout?package="+encodeURIComponent(p.id)+"&method=paykings"}>Pay with PayKings</a>
     :<span className="lg-bundle-disabled" aria-disabled="true">Pay with PayKings — Unavailable</span>}
    {bluevineEnabled?<a className="lg-bundle-bluevine" href={"/bundles/checkout?package="+encodeURIComponent(p.id)+"&method=bluevine"}>Pay with Bluevine</a>:null}
    <a href={"/bundles?package="+encodeURIComponent(p.id)+"#growth-bundles"}>See package in full</a>
   </div>
  </div>
  <p className="lg-bundles-note">One package price, not a separate charge for every post. Payments are independently verified before supplier fulfillment. Keep your order number for tracking and support.</p>
  {standalone&&<div className="lg-bundle-actions lg-bundle-support" aria-label="Bundle support">
   <a href="https://wa.me/19452106315" target="_blank" rel="noopener noreferrer">Manual order via WhatsApp</a>
   <a href="mailto:Litixsocial@gmail.com?subject=Litix%20Manual%20Bundle">Email Litix Support</a>
  </div>}
 </section>;
}
