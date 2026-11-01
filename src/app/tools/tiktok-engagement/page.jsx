"use client";
import {useMemo,useState} from "react";
import {engagementSnapshot,engagementCsv} from "../../../lib/tiktokEngagement.mjs";

const number=n=>new Intl.NumberFormat("en-US").format(n);
const percent=n=>n===null?"—":n.toFixed(2)+"%";
const initial={views:"",likes:"",comments:"",shares:"",saves:"",followers:""};
export default function TikTokEngagementCalculator(){
 const [fields,setFields]=useState(initial),[saved,setSaved]=useState([]),[error,setError]=useState("");
 const calculated=useMemo(()=>{
  try{return engagementSnapshot(Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.trim()===""?0:Number(v)])))}catch{return null}
 },[fields]);
 function set(key,value){
  setError("");setFields(old=>({...old,[key]:value}));
 }
 function save(){
  if(!calculated){setError("Enter valid, non-negative whole-number metrics.");return}
  if(calculated.views===0&&calculated.followers===0){setError("Enter video views or follower count to calculate a rate.");return}
  setSaved(old=>[calculated,...old].slice(0,12));setError("");
 }
 function csv(){
  if(!saved.length)return;
  const bytes=new Blob([engagementCsv(saved)],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(bytes),a=document.createElement("a");
  a.href=url;a.download="litix-tiktok-engagement.csv";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <main className="wrap">
  <nav className="nav"><a className="brand" href="/"><img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo"/></a>
   <div><a href="/shop">Shop Services</a><a href="/track">Track Order</a><a href="/services">All Litix Services</a></div></nav>
  <section className="panel" style={{maxWidth:960,margin:"28px auto"}}>
   <div className="kicker">LITIX CREATOR TOOLS · FREE</div>
   <h1>TikTok Engagement Calculator</h1>
   <p>Measure video engagement using your own visible numbers. No login, payment, password or account connection required. Results stay in this browser tab.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:16,marginTop:24}}>
    {Object.keys(initial).map(key=><label key={key} style={{display:"grid",gap:8}}>
     <span style={{fontWeight:700,textTransform:"capitalize"}}>{key}</span>
     <input type="number" min="0" step="1" inputMode="numeric" aria-label={key} value={fields[key]}
      onChange={e=>set(key,e.target.value)} placeholder="0" style={{width:"100%",minWidth:0,padding:12,borderRadius:10}}/>
    </label>)}
   </div>
   {error&&<p role="alert">{error}</p>}
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:16,marginTop:26}} aria-live="polite">
    <div className="panel"><small>Interactions</small><h2>{calculated?number(calculated.interactions):"—"}</h2></div>
    <div className="panel"><small>Engagement by views</small><h2>{calculated?percent(calculated.byViews):"—"}</h2></div>
    <div className="panel"><small>Engagement by followers</small><h2>{calculated?percent(calculated.byFollowers):"—"}</h2></div>
   </div>
   <p className="small">Interactions = likes + comments + shares + saves. Engagement by views = interactions ÷ views × 100.
   Engagement by followers = interactions ÷ followers × 100. Missing denominator means the rate is unavailable.
   Percentages can exceed 100% because repeated actions and mixed metrics are possible. These are estimates from your inputs, not live TikTok API readings.</p>
   <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:18}}>
    <button type="button" onClick={save} disabled={!calculated}>Save comparison</button>
    <button type="button" onClick={csv} disabled={!saved.length}>Export CSV ({saved.length})</button>
    <button type="button" onClick={()=>{setFields(initial);setSaved([]);setError("")}}>Clear</button>
   </div>
  </section>
  {saved.length>0&&<section className="panel" style={{maxWidth:960,margin:"18px auto"}} aria-label="Saved comparisons">
   <h2>Compare your latest entries</h2>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
    <thead><tr><th>Added</th><th>Views</th><th>Interactions</th><th>By views</th><th>By followers</th></tr></thead>
    <tbody>{saved.map((v,i)=><tr key={v.recordedAt+i}><td>{new Date(v.recordedAt).toLocaleTimeString()}</td>
     <td>{number(v.views)}</td><td>{number(v.interactions)}</td><td>{percent(v.byViews)}</td><td>{percent(v.byFollowers)}</td></tr>)}</tbody>
   </table></div>
  </section>}
  <section className="panel" style={{maxWidth:960,margin:"18px auto 38px"}}>
   <h2>Ready to browse services?</h2>
   <p>Use the Litix live catalog to compare available services and review prices before placing an order.</p>
   <a href="/shop/tiktok/likes">TikTok Likes</a> · <a href="/shop/tiktok/views">TikTok Views</a> · <a href="/track">Track an existing order</a>
  </section>
 </main>;
}
