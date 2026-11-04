"use client";
import {useState} from "react";
import Link from "next/link";
import "../../solutions/solutions.css";
const checks=[
 ["profile","Our Google Business Profile is claimed and accurate."],
 ["hours","Address, service area, phone and operating hours are current."],
 ["services","We describe our actual services and what makes them useful."],
 ["website","Our website is mobile-friendly and includes clear calls to action."],
 ["contact","People can contact or book with us without unnecessary steps."],
 ["reviews","We invite genuine customer feedback and respond appropriately."],
 ["photos","We have recent, authentic business images or examples."],
 ["measurement","We review website traffic, inquiries and bookings each month."]
];
export default function LitixLocalVisibility(){
 const [marked,setMarked]=useState([]);
 const count=marked.length;
 const percent=Math.round(count/checks.length*100);
 return <main className="ls-main">
  <nav className="ls-nav"><Link className="ls-brand" href="/"><img src="/assets/brand/litix-logo.webp" width="126" height="68" alt="Litix home"/></Link><div><Link href="/solutions">Solutions</Link><Link href="/growth">Calendar</Link></div></nav>
  <section className="ls-hero ls-detail-hero"><span className="ls-eyebrow">FREE SELF-ASSESSMENT</span><h1>Local Visibility Checklist</h1><p>Evaluate your business's basic online presence. This checklist uses only your answers—Litix does not access Google accounts or make a live SEO audit.</p></section>
  <section className="ls-panel ls-tool-panel">
   <h2>How prepared is your business?</h2>
   <p className="ls-stats"><strong>{count} of {checks.length}</strong> completed · {percent}%</p>
   <div role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={checks.length} aria-label="Local visibility checklist progress" style={{height:12,background:"#0c2542",borderRadius:10,overflow:"hidden",margin:"18px 0"}}>
    <div style={{width:percent+"%",height:"100%",background:"#80d9ff",borderRadius:10}}/>
   </div>
   <div style={{display:"grid",gap:10}}>
    {checks.map(([id,label])=><label key={id} style={{display:"flex",alignItems:"flex-start",gap:12,border:"1px solid #75b5e34b",borderRadius:11,padding:14,background:marked.includes(id)?"#143b4a":"#0a1a2b",lineHeight:1.5}}>
     <input type="checkbox" style={{width:18,height:18,marginTop:3,flexShrink:0}} checked={marked.includes(id)} onChange={e=>setMarked(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/>
     {label}
    </label>)}
   </div>
   <h2 style={{marginTop:27}}>Suggested next step</h2>
   <p>{count===8?"You have the basics covered. Consider measuring which marketing activities generate qualified inquiries.":count>=5?"Focus on the unchecked items and track whether they help convert more local visitors into inquiries.":"Work through the unchecked essentials before spending heavily on promotions or advertising."}</p>
   <div className="ls-tool-actions"><button type="button" onClick={()=>setMarked([])}>Reset checklist</button><Link className="ls-cta" href="/solutions/local">Request local marketing review</Link></div>
   <p className="ls-note">Self-reported results only. No search ranking, advertising performance or lead-generation guarantee is implied.</p>
  </section>
 </main>;
}
