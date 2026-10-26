"use client";
import {useEffect,useState} from "react";
import {GROWTH_BUNDLES,BUNDLE_INSTRUCTIONS,growthBundle} from "../lib/growthBundles.mjs";
const fmt=n=>new Intl.NumberFormat("en-US").format(n);
const currency=n=>"$"+(n/100).toFixed(2);
export default function GrowthBundles({standalone=false}){
 const [platform,setPlatform]=useState("Instagram");
 useEffect(()=>{const selected=growthBundle(new URLSearchParams(location.search).get("package"));if(selected)setPlatform(selected.platform)},[]);
 return <section id="growth-bundles" className="lg-bundles panel" aria-label="Litix Growth Bundles">
  <div className="lg-bundles-heading"><div><span className="kicker">BEST SELLERS · LITIX</span><h2>LITIX GROWTH BUNDLES</h2><p>One package. Multiple engagement services. Personalized order coordination.</p></div><span className="lg-bundles-seal">MANUALLY COORDINATED</span></div>
  <div className="lg-bundles-tabs" role="group" aria-label="Growth bundle platform">
   {["Instagram","TikTok"].map(p=><button type="button" key={p} className={platform===p?"lg-tab active":"lg-tab"} aria-pressed={platform===p} onClick={()=>setPlatform(p)}>{p}</button>)}
  </div>
  <div className="lg-bundles-grid">{GROWTH_BUNDLES.filter(p=>p.platform===platform).map((p,i)=><article key={p.id} id={"bundle-"+p.id} className={"lg-bundle-card lg-tier-"+p.tier.toLowerCase()}>
   <div className="lg-bundle-art" aria-hidden="true"><span className="lg-art-letter">{p.tier.substring(0,1)}</span><span className="lg-art-orbit"/><span className="lg-art-platform">{p.platform.toUpperCase()}</span></div>
   <div className="lg-bundle-head"><span className="lg-tier">{p.tier}</span>{i===1||i===3?<span className="lg-popular">POPULAR</span>:null}</div>
   <strong className="lg-price">{currency(p.priceCents)}</strong>
   <p className="lg-bundle-small">Package totals · distribute across up to 10 posts</p>
   <dl className="lg-bundle-items">{Object.entries(p.items).map(([kind,quantity])=><div key={kind}><dt>{kind}</dt><dd>{fmt(quantity)}</dd></div>)}</dl>
   <p className="lg-bundle-small">Refills: supplier-dependent only; no guaranteed refill.</p>
   <p className="lg-bundle-warning">{BUNDLE_INSTRUCTIONS}</p>
   <div className="lg-bundle-actions"><a href={"/bundles?package="+encodeURIComponent(p.id)+"#bundle-"+p.id}>View Package</a><a className="lg-bundle-buy" href={"/bundles/checkout?package="+encodeURIComponent(p.id)}>Purchase Bundle</a></div>
  </article>)}</div>
  <p className="lg-bundles-note">All bundles require the customer to submit public post URLs or identifiable screenshots through the verified LITIX WhatsApp contact. Screenshots must be matched to public post URLs before fulfillment. No delivery occurs without manual admin approval.</p>
 </section>;
}
