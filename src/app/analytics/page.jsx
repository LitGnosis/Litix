"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {
 ANALYTICS_STORE_KEY,ANALYTICS_PLATFORMS,MAX_CAMPAIGNS,MAX_SNAPSHOTS,
 validateAnalyticsCampaign,validateAnalyticsSnapshot,restoreAnalytics,
 upsertAnalyticsCampaign,addAnalyticsSnapshot,analyticsSummary,analyticsCsv
} from "../../lib/platinumAnalyticsStudio.mjs";
import "./analytics.css";
const isoToday=()=>new Date().toLocaleDateString("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"});
const startCampaign=()=>({name:"",platform:"Instagram",goal:"",website:""});
const emptySnapshot=()=>({date:isoToday(),followers:0,impressions:0,views:0,likes:0,comments:0,shares:0,clicks:0,leads:0,spendCents:0});
const number=n=>Number(n??0).toLocaleString("en-US");
const fmtPct=n=>n===null||n===undefined?"—":n.toLocaleString("en-US",{maximumFractionDigits:2})+"%";
const money=n=>n===null||n===undefined?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const labels={followers:"Followers",impressions:"Impressions",views:"Views",likes:"Likes",comments:"Comments",shares:"Shares",clicks:"Link clicks",leads:"Leads",spendCents:"Spend (USD cents)"};
function MiniTrend({data,field="followers"}){
 const values=data?.map(x=>Number(x[field]||0))||[];
 if(values.length<2)return <div className="la-chart-empty">Add two dated snapshots to display a trend.</div>;
 const min=Math.min(...values),max=Math.max(...values);
 const range=max-min||1;
 const points=values.map((v,i)=>(22+i*596/Math.max(1,values.length-1)).toFixed(1)+","+(150-(v-min)/range*120).toFixed(1)).join(" ");
 return <svg viewBox="0 0 640 174" role="img" aria-label={field+" trend from "+number(values[0])+" to "+number(values.at(-1))} preserveAspectRatio="none">
  <defs><linearGradient id="la-line" x1="0" x2="1"><stop stopColor="#8af5ff"/><stop offset="1" stopColor="#5e9dff"/></linearGradient></defs>
  {[30,70,110,150].map(y=><line key={y} x1="10" x2="630" y1={y} y2={y} stroke="#376493" opacity=".35"/>)}
  <polyline fill="none" points={points} stroke="url(#la-line)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
  <circle cx={22+(values.length-1)*596/Math.max(1,values.length-1)} cy={150-(values.at(-1)-min)/range*120} r="6" fill="#a4edff"/>
 </svg>;
}
export default function AnalyticsStudio(){
 const [campaigns,setCampaigns]=useState([]);
 const [ready,setReady]=useState(false),[selectedId,setSelectedId]=useState("");
 const [draft,setDraft]=useState(startCampaign),[snapshot,setSnapshot]=useState(emptySnapshot);
 const [notice,setNotice]=useState(""),[tab,setTab]=useState("overview");
 const [trendMetric,setTrendMetric]=useState("followers");
 useEffect(()=>{
  try{const saved=restoreAnalytics(localStorage.getItem(ANALYTICS_STORE_KEY)||"[]");setCampaigns(saved);setSelectedId(saved[0]?.id||"");}
  catch{setNotice("Private browser storage is unavailable; export a CSV to preserve your data.");}
  setReady(true);
 },[]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(ANALYTICS_STORE_KEY,JSON.stringify(campaigns));}
 catch{setNotice("Browser storage is full or unavailable. Export a CSV now.");}},[campaigns,ready]);
 const current=campaigns.find(x=>x.id===selectedId)||campaigns[0]||null;
 const summary=useMemo(()=>analyticsSummary(current),[current]);
 const onCreate=e=>{
  e.preventDefault();const v=validateAnalyticsCampaign(draft);
  if(!v.ok){setNotice(v.error);return}
  try{
   const id="campaign_"+crypto.randomUUID().replace(/-/g,"").slice(0,12);
   const entry={id,...v.value,createdAt:isoToday(),snapshots:[]};
   setCampaigns(old=>upsertAnalyticsCampaign(old,entry));setSelectedId(id);
   setDraft(startCampaign());setTab("overview");setNotice("Campaign created. Metrics remain private in this browser.");
  }catch(err){setNotice(err.message==="campaign_limit_reached"?"Maximum of 30 campaigns reached. Export your data before removing one.":"Unable to save the campaign.");}
 };
 const onSnapshot=e=>{
  e.preventDefault();if(!current)return;
  const v=validateAnalyticsSnapshot(snapshot);
  if(!v.ok){setNotice(v.error);return}
  try{
   setCampaigns(old=>old.map(c=>c.id===current.id?addAnalyticsSnapshot(c,v.value):c));
   setNotice("Snapshot saved locally. These are user-entered metrics, not platform-verified analytics.");
   setSnapshot(emptySnapshot());setTab("overview");
  }catch(err){setNotice("Unable to save snapshot: "+err.message)}
 };
 const download=()=>{
  if(!campaigns.some(c=>c.snapshots.length)){setNotice("Add a snapshot before exporting.");return}
  const url=URL.createObjectURL(new Blob([analyticsCsv(campaigns)],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="litix-platinum-analytics.csv";
  a.click();URL.revokeObjectURL(url);setNotice("CSV export prepared. Data stays on this device.");
 };
 const removeCampaign=()=>{
  if(!current||!window.confirm("Delete this locally saved campaign and all its snapshots? Export first if you need them."))return;
  setCampaigns(old=>old.filter(x=>x.id!==current.id));setSelectedId(campaigns.find(x=>x.id!==current.id)?.id||"");setNotice("Campaign deleted from this browser.");
 };
 const removeSnapshot=date=>{
  if(!current||!window.confirm("Remove the "+date+" snapshot?"))return;
  setCampaigns(old=>old.map(c=>c.id===current.id?{...c,snapshots:c.snapshots.filter(x=>x.date!==date)}:c));
 };
 return <main className="la-app">
  <div className="la-shell">
   <nav className="la-nav" aria-label="Analytics navigation"><Link href="/" className="la-brand"><img src="/assets/brand/litix-logo.webp" width="108" height="42" alt="Litix home"/></Link>
    <div className="la-navlinks"><Link href="/growth">Growth Calendar</Link><Link href="/track">Track Order</Link><Link href="/">Storefront</Link></div></nav>
   <header className="la-hero"><span className="la-kicker">LITIX PLATINUM • CREATOR INTELLIGENCE</span>
    <h1>Analytics Studio</h1>
    <p>Turn your campaign snapshots into a clearer growth story. Measure reach, engagement, conversions and spend—all without sharing account passwords.</p>
    <div className="la-hero-footer"><span>PRIVATE BY DESIGN</span><span>NO THIRD-PARTY TRACKERS</span><span>USER-ENTERED DATA</span></div>
   </header>
   <div className="la-banner" role="note">These charts use numbers you enter manually. They do <strong>not</strong> confirm organic engagement, campaign attribution or verified social-platform API data. Your snapshots are stored in this browser only.</div>
   <section className="la-actions" aria-label="Campaign selection"><label className="la-select">Campaign
     <select value={current?.id||""} onChange={e=>{setSelectedId(e.target.value);setTab("overview")}}>
      {!current&&<option value="">No campaigns yet</option>}
      {campaigns.map(c=><option key={c.id} value={c.id}>{c.name} · {c.platform}</option>)}
     </select></label>
    <div className="la-buttons"><button type="button" className="la-button-secondary" onClick={download}>Export CSV</button><button type="button" className="la-button-primary" onClick={()=>setTab("new")}>+ New campaign</button></div></section>
   {notice&&<div role="status" className="la-notice">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Dismiss notice">×</button></div>}
   {tab==="new"?<section className="la-panel la-editor"><div className="la-section-heading"><div><span className="la-kicker">NEW CAMPAIGN</span><h2>Define what you want to measure</h2></div><button type="button" onClick={()=>setTab("overview")}>Close</button></div>
    <form onSubmit={onCreate} className="la-form">
     <label>Campaign name<input required minLength={3} maxLength={100} placeholder="Holiday creator launch" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
     <label>Platform<select value={draft.platform} onChange={e=>setDraft({...draft,platform:e.target.value})}>{ANALYTICS_PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></label>
     <label>Goal (optional)<input maxLength={130} placeholder="Grow reach and qualified leads" value={draft.goal} onChange={e=>setDraft({...draft,goal:e.target.value})}/></label>
     <label>Public HTTPS link (optional)<input inputMode="url" placeholder="https://example.com" value={draft.website} onChange={e=>setDraft({...draft,website:e.target.value})}/></label>
     <div className="la-form-full"><button className="la-button-primary" type="submit" disabled={campaigns.length>=MAX_CAMPAIGNS}>Create campaign</button><small>Up to {MAX_CAMPAIGNS} campaigns per browser.</small></div>
    </form>
   </section>:null}
   {current&&tab!=="new"?<><section className="la-current"><div><span className="la-kicker">{current.platform.toUpperCase()} CAMPAIGN</span><h2>{current.name}</h2><p>{current.goal||"No goal has been added yet."}</p></div>
     <div className="la-buttons"><button type="button" onClick={()=>setTab(tab==="snapshot"?"overview":"snapshot")} className="la-button-primary">+ Add snapshot</button><button type="button" onClick={removeCampaign} className="la-danger">Delete campaign</button></div>
    </section>
    {tab==="snapshot"?<section className="la-panel la-editor"><h2>Add a dated snapshot</h2><p className="la-muted">Enter your latest cumulative dashboard totals—not the number gained since yesterday. Snapshots with the same date replace the previous entry.</p>
     <form onSubmit={onSnapshot} className="la-form">
      <label>Snapshot date<input required type="date" value={snapshot.date} onChange={e=>setSnapshot({...snapshot,date:e.target.value})}/></label>
      {Object.entries(labels).map(([k,v])=><label key={k}>{v}<input type="number" min={0} step={1} required inputMode="numeric" value={snapshot[k]} onChange={e=>setSnapshot({...snapshot,[k]:e.target.value})}/></label>)}
      <div className="la-form-full"><button type="submit" className="la-button-primary">Save private snapshot</button><small>Maximum {MAX_SNAPSHOTS} snapshots per campaign.</small></div>
     </form>
    </section>:null}
    <section className="la-metrics" aria-label="Latest recorded campaign metrics">
      {[
       ["Followers",summary.hasData?number(summary.followers):"—","Latest recorded"],
       ["Impressions",summary.hasData?number(summary.impressions):"—","Latest recorded"],
       ["Engagement",fmtPct(summary.engagementPercent),"Likes + comments + shares / impressions"],
       ["Click-through",fmtPct(summary.clickThroughPercent),"Clicks / impressions"],
       ["Lead conversion",fmtPct(summary.leadConversionPercent),"Leads / clicks"],
       ["Cost per lead",money(summary.costPerLeadUsd),"Recorded spend / leads"]
      ].map(([label,value,subtitle])=><article className="la-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{subtitle}</small></article>)}
    </section>
    <section className="la-grid">
     <article className="la-panel la-chart"><div className="la-section-heading"><div><span className="la-kicker">PERFORMANCE TREND</span><h2>Track the trajectory</h2></div>
        <select aria-label="Trend metric" value={trendMetric} onChange={e=>setTrendMetric(e.target.value)}>
        {["followers","impressions","clicks","leads"].map(v=><option key={v} value={v}>{labels[v]}</option>)}</select></div>
      <MiniTrend data={summary.trend} field={trendMetric}/>
      <div className="la-chart-footer"><span>{summary.firstDate||"No records yet"}</span><span>{summary.lastDate||"Add a snapshot"}</span></div>
     </article>
     <article className="la-panel la-insights"><span className="la-kicker">PLATINUM SNAPSHOT</span><h2>What the numbers say</h2>
      <div className="la-insight"><span>Follower change</span><strong>{summary.hasData?(summary.followerDelta>=0?"+":"")+number(summary.followerDelta):"—"}</strong></div>
      <div className="la-insight"><span>Follower change %</span><strong>{fmtPct(summary.followersChangePercent)}</strong></div>
      <div className="la-insight"><span>Recorded spend</span><strong>{summary.hasData?money(summary.spendCents/100):"—"}</strong></div>
      <div className="la-insight"><span>Cost per 1,000 impressions</span><strong>{money(summary.costPerThousandImpressionsUsd)}</strong></div>
      <p className="la-muted">For verified campaign attribution, connect approved platform analytics in a separate audited integration. This dashboard does not infer causal results from purchases.</p>
     </article>
    </section>
    <section className="la-panel"><div className="la-section-heading"><div><span className="la-kicker">AUDIT TRAIL</span><h2>Recorded snapshots</h2></div><small>{summary.snapshotCount||0} recorded</small></div>
      {current.snapshots.length?<div className="la-overflow"><table className="la-table"><thead><tr><th>Date</th><th>Followers</th><th>Impressions</th><th>Clicks</th><th>Leads</th><th>Spent</th><th>Action</th></tr></thead><tbody>
        {[...current.snapshots].reverse().map(s=><tr key={s.date}><td>{s.date}</td><td>{number(s.followers)}</td><td>{number(s.impressions)}</td><td>{number(s.clicks)}</td><td>{number(s.leads)}</td><td>{money(s.spendCents/100)}</td><td><button type="button" className="la-small" onClick={()=>removeSnapshot(s.date)}>Remove</button></td></tr>)}
       </tbody></table></div>:<p className="la-muted">No recorded snapshots yet. Add your starting numbers to begin a trend.</p>}
    </section>
   </>:tab!=="new"?<section className="la-empty"><h2>Start with one campaign.</h2><p>Give your campaign a name, choose a platform and start recording your own metrics. No login needed.</p><button type="button" className="la-button-primary" onClick={()=>setTab("new")}>Create your first campaign</button></section>:null}
   <footer className="la-footer"><span>Litix Analytics Studio · Private, user-entered campaign data</span><Link href="/growth">Open Growth Calendar</Link></footer>
  </div>
 </main>;
}
