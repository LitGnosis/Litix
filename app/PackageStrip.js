'use client';
import {useEffect,useState} from 'react';
const money=c=>`$${(Number(c||0)/100).toFixed(2)}`;
export default function PackageStrip(){
 const [packs,setPacks]=useState([]);
 useEffect(()=>{fetch('/api/packages').then(r=>r.json()).then(j=>setPacks(j.packages||[])).catch(()=>{})},[]);
 if(!packs.length)return null;
 return <section className="bundleSection" id="bundles">
  <div className="bundleHead"><div><span className="kicker">LITIX BUNDLES</span><h2>More growth in one package.</h2><p>Bundle likes, views and other engagement credits, then use them across multiple public posts or videos.</p></div><a className="linkButton" href="/packages">View all bundles</a></div>
  <div className="bundleRail">{packs.map(p=><article className={`bundleCard ${p.available?'':'bundleUnavailable'}`} key={p.id}><div className="bundleTop"><span className="bundlePlatform">{p.platform}</span><span className="statusPill">{p.available?'Ready':'Verifying'}</span></div><h3>{p.tier}</h3><div className="bundlePrice">{money(p.priceCents)}</div><ul>{p.items.slice(0,4).map(x=><li key={x.kind}><b>{Number(x.quantity).toLocaleString()}</b> {x.kind}</li>)}</ul>{p.items.length>4&&<p className="miniMuted">+ {p.items.length-4} more included services</p>}<a className="bundleLink" href="/packages">See package →</a></article>)}</div>
 </section>
}
