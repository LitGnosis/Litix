"use client";
import {useEffect,useMemo,useState} from "react";

const validService=x=>/^litix_\d{1,12}$/.test(String(x?.id||""))&&x?.purchasable===true;
const safeRead=(key,max=30)=>{
 try{
  const data=JSON.parse(localStorage.getItem(key)||"[]");
  return Array.isArray(data)?data.slice(0,max):[];
 }catch{return []}
};
const money=c=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(c||0)/100);
function orderHref(item){
 if(!/^ltx2_[a-f0-9-]{36}$/i.test(String(item?.id||"")))return "/track";
 try{
  const u=new URL(item.url,location.origin);
  if(!["litix.net","www.litix.net"].includes(u.hostname)||u.protocol!=="https:")return "/track?order="+encodeURIComponent(item.id);
  if(u.searchParams.get("track")!==item.id||!(u.searchParams.get("token")||"").match(/^[a-zA-Z0-9_-]{25,150}$/))
   return "/track?order="+encodeURIComponent(item.id);
  return "/track?track="+encodeURIComponent(item.id)+"&token="+encodeURIComponent(u.searchParams.get("token"));
 }catch{return "/track?order="+encodeURIComponent(item.id)}
}
const goalSteps=Object.freeze({
 "Grow audience":["Record your current audience size.","Prepare three recurring content themes.","Review reach and saves each week."],
 "Increase engagement":["Measure current engagement by content format.","Schedule two useful community-first posts.","Review comments and meaningful interactions."],
 "Launch a product":["Write a simple offer and product page.","Draft a product demonstration.","Review clicks and qualified inquiries."],
 "Generate leads":["Define your ideal customer and landing page.","Draft a useful outreach message.","Track consent-based inquiries and booked calls."],
 "Build brand awareness":["Define your brand promise and three proof points.","Plan short-form creative for two channels.","Review reach and branded searches."],
 "Improve content consistency":["Choose a realistic publishing cadence.","Batch three weeks of draft ideas.","Review completion and adjust the calendar."]
});
export default function LitixWorkspace(){
 const [ready,setReady]=useState(false);
 const [campaigns,setCampaigns]=useState([]);
 const [favorites,setFavorites]=useState([]);
 const [recent,setRecent]=useState([]);
 const [orders,setOrders]=useState([]);
 const [services,setServices]=useState([]);
 const [catalogNote,setCatalogNote]=useState("Loading available service options…");
 const [campaignName,setCampaignName]=useState("");
 const [goal,setGoal]=useState("Grow audience");
 const [role,setRole]=useState("Creator");
 const [horizon,setHorizon]=useState("30");
 const [plan,setPlan]=useState(null);
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  setCampaigns(safeRead("litix:campaigns",20));
  setFavorites(safeRead("litix:favorites",12).filter(validService));
  setRecent(safeRead("litix:recent-services",8).filter(validService));
  setOrders(safeRead("litix:saved-orders",12));
  setReady(true);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6000);
  fetch("/api/catalog/v1?page=1",{signal:controller.signal,cache:"no-store"})
   .then(async r=>{if(!r.ok)throw Error("catalog_offline");return r.json()})
   .then(data=>{
    if(controller.signal.aborted)return;
    const items=(Array.isArray(data.items)?data.items:[]).filter(validService).slice(0,8);
    setServices(items);
    setCatalogNote(items.length?"Choose ☆ Save to bookmark a service on this device.":"No service suggestions are available. Your saved items are still here.");
   })
   .catch(()=>{if(!controller.signal.aborted)setCatalogNote("Service suggestions are temporarily unavailable. Your saved campaigns and links are still here.")})
   .finally(()=>clearTimeout(timer));
  return()=>{clearTimeout(timer);controller.abort()};
 },[]);
 useEffect(()=>{
  if(!ready)return;
  try{
   localStorage.setItem("litix:campaigns",JSON.stringify(campaigns.slice(0,20)));
   localStorage.setItem("litix:favorites",JSON.stringify(favorites.slice(0,12)));
  }catch{setNotice("Browser storage is restricted. Copy important campaign details before closing this tab.")}
 },[ready,campaigns,favorites]);
 function createCampaign(e){
  e.preventDefault();
  const name=campaignName.trim();
  if(!name)return;
  setCampaigns(current=>[{id:Date.now(),name,goal,status:"Planning",createdAt:new Date().toISOString()},...current].slice(0,20));
  setCampaignName("");
  setNotice("Campaign saved on this device.");
 }
 function toggleFavorite(service){
  if(!validService(service))return;
  setFavorites(current=>current.some(x=>x.id===service.id)?
   current.filter(x=>x.id!==service.id):
   [{id:service.id,name:service.name,category:service.category,min:service.min,max:service.max,
    per1000:service.per1000,purchasable:true},...current].slice(0,12));
 }
 function generatePlan(){
  setPlan({goal,role,horizon,steps:goalSteps[goal]||goalSteps["Grow audience"]});
  setNotice("Your plan is ready below. Use the content calendar to organize publication dates.");
 }
 const savedIds=useMemo(()=>new Set(favorites.map(x=>x.id)),[favorites]);
 return <main className="wrap litix-workspace-page">
  <nav className="nav" aria-label="Litix workspace navigation">
   <a className="brand" href="/">LITIX</a>
   <div><a href="/">Home</a><a href="/#checkout">Checkout</a><a href="/bundles">Bundles</a><a href="/growth">Content Calendar</a><a href="/track">Track Orders</a></div>
  </nav>
  <section className="panel">
   <span className="kicker">LITIX GROWTH OS</span>
   <h1>Campaigns, content and saved services</h1>
   <p>Instant Browser Workspace — No account required to plan campaigns. Bookmark your private tracking links anytime.</p>
   <p className="small">Saved items remain on this device. For access on another device, export or copy your important details.</p>
  </section>
  <section className="panel growth-studio" id="growth-studio" aria-label="Litix Growth OS plan">
   <span className="kicker">GROWTH PLANNING</span><h2>Build your next growth plan</h2>
   <div className="growth-controls">
    <label>Your role<select value={role} onChange={e=>setRole(e.target.value)}>
      {["Creator","Personal brand","Agency","Small business","Brand / enterprise"].map(x=><option key={x}>{x}</option>)}
     </select></label>
    <label>Primary goal<select value={goal} onChange={e=>setGoal(e.target.value)}>
      {Object.keys(goalSteps).map(x=><option key={x}>{x}</option>)}
     </select></label>
    <label>Planning horizon<select value={horizon} onChange={e=>setHorizon(e.target.value)}>
      <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
     </select></label>
    <button type="button" className="primary" onClick={generatePlan}>Build my plan</button>
   </div>
   {plan&&<div className="growth-plan" aria-live="polite"><h3>{plan.horizon}-day plan · {plan.goal}</h3>
    <p className="small">Planning guidance for {plan.role.toLowerCase()}; not live analytics or guaranteed growth.</p>
    <ol>{plan.steps.map(step=><li key={step}>{step}</li>)}</ol>
    <a className="alt" href="/growth">Open the full Litix Content Calendar</a>
   </div>}
   {!plan&&<p className="small">Select a goal and build a plan, or <a href="/growth">open your Content Calendar</a>.</p>}
  </section>
  <section className="panel campaign-studio" id="campaign-studio" aria-label="Campaign workspace">
   <span className="kicker">CAMPAIGN WORKSPACE</span><h2>Your campaigns</h2>
   <form className="campaign-form" onSubmit={createCampaign}>
    <input aria-label="Campaign name" placeholder="e.g. New client outreach" maxLength={100} value={campaignName} onChange={e=>setCampaignName(e.target.value)} required/>
    <button className="primary" type="submit">Create campaign</button>
   </form>
   {campaigns.map(c=><div key={c.id} className="workspace-row">
    <div className="workspace-link"><strong>{c.name}</strong><small>{c.goal} · {c.createdAt?new Date(c.createdAt).toLocaleDateString():"Saved campaign"}</small></div>
    <select aria-label={"Campaign status for "+c.name} value={c.status||"Planning"}
     onChange={e=>setCampaigns(current=>current.map(x=>x.id===c.id?{...x,status:e.target.value}:x))}>
     {["Planning","In progress","Review","Completed"].map(v=><option key={v}>{v}</option>)}
    </select>
    <button type="button" className="icon-action" aria-label={"Delete "+c.name}
     onClick={()=>setCampaigns(current=>current.filter(x=>x.id!==c.id))}>×</button>
   </div>)}
   {!campaigns.length&&<div className="litix-starter">
    <p>No campaign created yet. Start with one of these ideas:</p>
    <div className="litix-starter-actions">
     <button type="button" className="alt" onClick={()=>{setCampaignName("7-day content sprint");setGoal("Improve content consistency")}}>7-day content sprint</button>
     <button type="button" className="alt" onClick={()=>{setCampaignName("New client outreach");setGoal("Generate leads")}}>Client outreach</button>
    </div>
    <p className="small">Choose a template, then select Create campaign above to save it.</p>
   </div>}
   {notice&&<p role="status" aria-live="polite">{notice}</p>}
  </section>
  <section className="panel workspace" id="workspace" aria-label="Saved browser workspace">
   <span className="kicker">YOUR LITIX WORKSPACE</span><h2>Saved services and order links</h2>
   <div className="workspace-grid">
    <article><h3>Saved services</h3>
     {favorites.map(s=><div key={s.id} className="workspace-row">
      <a className="workspace-link" href={"/?service="+encodeURIComponent(s.id)+"#checkout"}>{s.name}<small>{s.category||"Litix service"}</small></a>
      <button type="button" className="icon-action" aria-label={"Remove "+s.name} onClick={()=>toggleFavorite(s)}>×</button>
     </div>)}
     {!favorites.length&&<p className="small">Save one of the available services below to find it again easily.</p>}
     {services.map(s=><button key={s.id} type="button" className="save-service" onClick={()=>toggleFavorite(s)}>
      {savedIds.has(s.id)?"★ Saved":"☆ Save"} · {s.name} {Number(s.per1000)>0?"· from "+money(Math.ceil(s.per1000*s.min/10)):""}
     </button>)}
     <p className="small">{catalogNote}</p>
    </article>
    <article><h3>Recent service selections</h3>
     {recent.map(s=><a href={"/?service="+encodeURIComponent(s.id)+"#checkout"} key={s.id} className="workspace-row workspace-link">{s.name}<small>Return to checkout</small></a>)}
     {!recent.length&&<p className="small">Your recently selected service options will appear here. <a href="/#checkout">Browse checkout</a>.</p>}
    </article>
    <article><h3>Private order links</h3>
     {orders.filter(o=>/^ltx2_[a-f0-9-]{36}$/i.test(String(o?.id||""))).map(o=><div className="workspace-row" key={o.id}>
      <a className="workspace-link" href={orderHref(o)}>{o.id}<small>{o.payment||"View order"} · {o.fulfillment||"Tracking available"}</small></a>
     </div>)}
     {!orders.length&&<p className="small">After a purchase, save the private link supplied with your receipt, or <a href="/track">look up an existing order</a>.</p>}
    </article>
   </div>
   <p className="small">Private order links are confidential. Share them only with people authorized to view your order.</p>
  </section>
 </main>;
}
