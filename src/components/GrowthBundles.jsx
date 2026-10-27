"use client";
import {useEffect,useState} from "react";
import {GROWTH_BUNDLES,BUNDLE_INSTRUCTIONS,growthBundle} from "../lib/growthBundles.mjs";
const fmt=n=>new Intl.NumberFormat("en-US").format(n);
const currency=n=>"$"+(n/100).toFixed(2);
export default function GrowthBundles({standalone=false}){
 const [platform,setPlatform]=useState("Instagram");
 const [bluevineEnabled,setBluevineEnabled]=useState(false);
 const [payKingsEnabled,setPayKingsEnabled]=useState(false);
 useEffect(()=>{const selected=growthBundle(new URLSearchParams(location.search).get("package"));if(selected)setPlatform(selected.platform);
  fetch("/api/bundles",{cache:"no-store"}).then(r=>r.json()).then(d=>{setBluevineEnabled(d.bluevineEnabled===true);setPayKingsEnabled(d.checkoutEnabled===true)}).catch(()=>setBluevineEnabled(false));},[]);
 return <section id="growth-bundles" className="lg-bundles panel" aria-label="Litix Growth Bundles">
  <div className="lg-bundles-heading"><div><span className="kicker">BEST SELLERS · LITIX</span><h2>LITIX GROWTH BUNDLES</h2><p>One package. Multiple engagement services. Personalized order coordination.</p></div><span className="lg-bundles-seal">MANUALLY COORDINATED</span></div>
  <div className="lg-bundles-tabs" role="group" aria-label="Growth bundle platform">
   {["Instagram","TikTok"].map(p=><button type="button" key={p} className={platform===p?"lg-tab active":"lg-tab"} aria-pressed={platform===p} onClick={()=>setPlatform(p)}>{p}</button>)}
  </div>
  <div className="lg-bundles-grid">{GROWTH_BUNDLES.filter(p=>p.platform===platform).map((p,i)=><article key={p.id} id={"bundle-"+p.id} className={"lg-bundle-card lg-tier-"+p.tier.toLowerCase()}>
   <div className="lg-bundle-art" aria-hidden="true"><span className="lg-art-letter">{p.tier.substring(0,1)}</span><span className="lg-art-orbit"/><span className="lg-art-platform">{p.platform.toUpperCase()}</span></div>
   <div className="lg-bundle-head"><span className="lg-tier">{p.tier}</span>{i===1||i===3?<span className="lg-popular">POPULAR</span>:null}</div>
   <strong className="lg-price">{currency(p.priceCents)}</strong>
   <p className="lg-bundle-small">Package totals · post engagement across up to 10 posts; Followers to your account</p>
   <dl className="lg-bundle-items">{Object.entries(p.items).map(([kind,quantity])=><div key={kind}><dt>{kind}</dt><dd>{fmt(quantity)}</dd></div>)}</dl>
   <p className="lg-bundle-small">Refills: supplier-dependent only; no guaranteed refill.</p>
   <p className="lg-bundle-warning">{BUNDLE_INSTRUCTIONS}</p>
   <div className="lg-bundle-actions"><a href={"/bundles?package="+encodeURIComponent(p.id)+"#bundle-"+p.id}>View Package</a>{payKingsEnabled?<a className="lg-bundle-buy" href={"/bundles/checkout?package="+encodeURIComponent(p.id)+"&method=paykings"}>Pay with PayKings</a>:<span className="lg-bundle-disabled" aria-disabled="true" title="PayKings bundle checkout is unavailable until merchant activation">Pay with PayKings — Unavailable</span>}{bluevineEnabled?<a className="lg-bundle-bluevine" href={"/bundles/checkout?package="+encodeURIComponent(p.id)+"&method=bluevine"}>Pay with Bluevine</a>:null}</div>
  </article>)}</div>
  <p className="lg-bundles-note">All bundles require the customer to submit their order number and up to 10 public post links or identifiable screenshots through WhatsApp, email, or Instagram. Screenshots must be matched to public post URLs before fulfillment. No delivery occurs without manual admin approval.</p>
 </section>;
}
