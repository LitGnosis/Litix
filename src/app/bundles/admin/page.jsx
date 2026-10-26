"use client";
import {useState} from "react";
import {BUNDLE_KINDS,BUNDLE_INSTRUCTIONS} from "../../../lib/growthBundles.mjs";
const zero=()=>Object.fromEntries(BUNDLE_KINDS.map(k=>[k,0]));
export default function BundleAdmin(){
 const [token,setToken]=useState(""),[data,setData]=useState(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),
  [active,setActive]=useState(""),[url,setUrl]=useState(""),[allocations,setAllocations]=useState(zero),
  [mappings,setMappings]=useState([]),[mapPlatform,setMapPlatform]=useState("Instagram"),[mapKind,setMapKind]=useState("Likes"),[serviceId,setServiceId]=useState("");
 const headers=()=>({"authorization":"Bearer "+token,"content-type":"application/json"});
 async function refresh(){
  if(!token)return;
  setBusy(true);setMessage("");
  try{const r=await fetch("/api/bundles/admin",{headers:headers(),cache:"no-store"});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Authorization failed");setData(v);
   const maps=await fetch("/api/bundles/mappings",{headers:headers(),cache:"no-store"});if(maps.ok)setMappings((await maps.json()).mappings||[]);
  }catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 async function verifySupplierMap(e){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/bundles/mappings",{method:"POST",headers:headers(),
    body:JSON.stringify({platform:mapPlatform,kind:mapKind,serviceId})});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Supplier service not verified");
   setMessage("Verified SMMGLOB "+v.platform+" "+v.kind+" #"+v.serviceId+" · $"+v.rateUsdPerThousand+"/1000");
   const q=await fetch("/api/bundles/mappings",{headers:headers(),cache:"no-store"});if(q.ok)setMappings((await q.json()).mappings||[]);
  }catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 async function run(action,orderId,extras={}){
  setBusy(true);setMessage("");
  try{const r=await fetch("/api/bundles/admin",{method:"POST",headers:headers(),
    body:JSON.stringify({action,orderId,...extras})});const v=await r.json();
   if(!r.ok&&r.status!==202)throw Error(v.error||"Operation could not complete");
   setMessage(action+": "+(v.status||v.reason||(v.ok?"Recorded":"Needs review")));
   const r2=await fetch("/api/bundles/admin",{headers:headers(),cache:"no-store"});if(r2.ok)setData(await r2.json());
  }catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 return <main className="wrap"><nav className="nav"><a href="/" className="brand">LITIX</a><a href="/bundles">Growth Bundles</a></nav>
  <section className="panel" style={{maxWidth:1050,margin:"25px auto"}}>
   <div className="kicker">LITIX · PROTECTED ADMIN</div><h1>Growth Bundle Management</h1>
   <p className="small">Restricted to a server-verified administrator. The token is held in this page's memory only. No supplier order is created unless you explicitly approve and release that individual allocation.</p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><input style={{flex:"1 1 260px"}} type="password" autoComplete="off" aria-label="Administrator access token" placeholder="Enter administrator access token" value={token} onChange={e=>setToken(e.target.value)}/><button className="pay" disabled={!token||busy} onClick={refresh}>Load authorized orders</button></div>
   {message&&<p role="status" className="msg">{message}</p>}
   {!data&&<p className="small">Administration is unavailable until your configured server-side administrator credential is verified.</p>}
   {data&&<section className="panel" style={{marginTop:20}}>
   <h2>Verify SMMGLOB service routes</h2>
   <p className="small">Enter only actual SMMGLOB service IDs. The server checks the supplier live catalog, platform, category, min/max and wholesale rate before saving each mapping. This does not send any paid supplier orders.</p>
   <form onSubmit={verifySupplierMap} style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
    <label>Platform<select value={mapPlatform} onChange={e=>setMapPlatform(e.target.value)}><option>Instagram</option><option>TikTok</option></select></label>
    <label>Service<select value={mapKind} onChange={e=>setMapKind(e.target.value)}>{BUNDLE_KINDS.map(k=><option key={k}>{k}</option>)}</select></label>
    <label>Supplier service ID<input value={serviceId} onChange={e=>setServiceId(e.target.value)} required pattern="[0-9]+" placeholder="SMMGLOB ID"/></label>
    <button className="pay" disabled={busy||!serviceId}>Verify and save mapping</button>
   </form>
   <p className="small">{mappings.length}/12 platform/service mappings verified. All twelve plus supplier cost coverage are required to enable bundle checkout.</p>
   {mappings.map(m=><p key={m.platform+":"+m.kind} className="small">{m.platform} {m.kind} · SMMGLOB #{m.service_id} · ${Number(m.provider_rate_usd).toFixed(4)} per 1,000 · {m.min_qty}–{m.max_qty} units · {m.refill_days==null?"No verified refill duration":m.refill_days+"-day refill"}</p>)}
  </section>}
  {data?.orders.map(o=><article key={o.id} className="panel" style={{marginTop:20}}>
    <div className="kicker">{o.platform} · {o.package_name}</div><h2>{o.id}</h2>
    <p><strong>Retail:</strong> {"$"+(o.price_cents/100).toFixed(2)} · <strong>Customer:</strong> {o.email}</p>
    <p><strong>Payment:</strong> {o.payment_state} · <strong>Status:</strong> {o.order_state}</p>
    <p className="small">Package totals: {Object.entries(o.package_items).map(([k,v])=>k+" "+Number(v).toLocaleString()).join(" · ")}</p>
    <p className="small">Remaining unallocated: {Object.entries(o.package_items).map(([kind,total])=>kind+" "+Math.max(0,Number(total)-(data.posts||[]).filter(p=>p.order_id===o.id&&p.status!=="Rejected").reduce((sum,p)=>sum+Number(p.allocations?.[kind]||0),0)).toLocaleString()).join(" · ")}</p>
    <button disabled={busy||!o.gateway_transaction_id} onClick={()=>run("refreshSettlement",o.id)}>Verify NMI settlement</button>
    <p className="lg-bundle-warning">{BUNDLE_INSTRUCTIONS}</p>
    <h3>Submitted posts ({(data.posts||[]).filter(p=>p.order_id===o.id&&p.status!=="Rejected").length}/10)</h3>
    {(data.posts||[]).filter(p=>p.order_id===o.id).map(p=><div key={p.id} style={{borderTop:"1px solid #6380a166",padding:"13px 0"}}>
     <p><a href={p.post_url} target="_blank" rel="noopener noreferrer">{p.post_url}</a> · <strong>{p.status}</strong></p>
     <p className="small">{Object.entries(p.allocations).map(([k,v])=>k+": "+Number(v).toLocaleString()).join(" · ")}</p>
     {p.status==="Under Review"&&<><button disabled={busy} onClick={()=>run("approvePost",o.id,{postId:p.id})}>Approve post</button>{" "}<button disabled={busy} onClick={()=>run("rejectPost",o.id,{postId:p.id})}>Reject post</button></>}
     {p.status==="Approved"&&<div>{BUNDLE_KINDS.filter(k=>Number(p.allocations[k])>0).map(kind=><button key={kind} type="button" disabled={busy} style={{margin:"4px 8px 4px 0"}} onClick={()=>run("release",o.id,{postId:p.id,kind})}>Release {kind} ({Number(p.allocations[kind]).toLocaleString()}) to SMMGLOB</button>)}</div>}
     {(data.dispatch||[]).filter(d=>d.post_id===p.id).map(d=><p className="small" key={d.id}>{d.kind} — {d.quantity.toLocaleString()} — {d.status} {d.supplier_order_id?" · supplier order "+d.supplier_order_id:""}</p>)}
    </div>)}
    <button className="alt" disabled={busy} onClick={()=>{setActive(active===o.id?"":o.id);setAllocations(zero());setUrl("")}}>{active===o.id?"Close entry":"Record WhatsApp post and allocation"}</button>
    {active===o.id&&<form className="form" style={{marginTop:14}} onSubmit={e=>{e.preventDefault();run("savePost",o.id,{url,allocations})}}>
      <label>Verified public {o.platform} post URL<input required type="url" value={url} onChange={e=>setUrl(e.target.value)}/></label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>{BUNDLE_KINDS.map(k=><label key={k}>{k}<input type="number" min="0" step="1" value={allocations[k]} onChange={e=>setAllocations(a=>({...a,[k]:Number(e.target.value)}))}/></label>)}</div>
      <p className="small">These numbers allocate from the purchased total. The database rejects allocations that exceed it.</p>
      <button className="pay" disabled={busy||!url}>Save for review — no supplier call</button>
    </form>}
   </article>)}
  </section></main>
}
