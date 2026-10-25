"use client";
import {useEffect,useMemo,useState} from "react";

const controls={width:"100%",padding:"13px 12px",boxSizing:"border-box",font:"inherit",color:"#eaf4ff",background:"#071624",border:"1px solid #537b96",borderRadius:11};
const primary={border:"1px solid #7dc7ea",borderRadius:12,padding:"12px 17px",background:"#194b66",color:"#effaff",font:"inherit",fontWeight:700,cursor:"pointer"};
const secondary={...primary,background:"transparent"};
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
export default function AutoLikesDrafts(){
 const [campaigns,setCampaigns]=useState([]);
 const [platform,setPlatform]=useState("instagram"),[services,setServices]=useState([]);
 const [serviceId,setServiceId]=useState(""),[target,setTarget]=useState(""),[quantity,setQuantity]=useState(1000),[posts,setPosts]=useState(10);
 const [loading,setLoading]=useState(false),[pending,setPending]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [key,setKey]=useState("");
 const activeService=useMemo(()=>services.find(s=>s.id===serviceId)||null,[services,serviceId]);
 useEffect(()=>{setKey(crypto.randomUUID())},[]);
 useEffect(()=>{
  const ctl=new AbortController();setLoading(true);setError("");
  fetch("/api/account/autolikes",{cache:"no-store",signal:ctl.signal})
   .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Campaigns unavailable");setCampaigns(v.campaigns||[])})
   .catch(e=>{if(!ctl.signal.aborted)setError(e.message)})
   .finally(()=>{if(!ctl.signal.aborted)setLoading(false)});
  return()=>ctl.abort();
 },[]);
 useEffect(()=>{
  const ctl=new AbortController();
  setServices([]);setServiceId("");setNotice("");setLoading(true);
  fetch("/api/account/autolikes?platform="+encodeURIComponent(platform),{cache:"no-store",signal:ctl.signal})
   .then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Supplier services are unavailable");setServices(v.services||[]);setServiceId(v.services?.[0]?.id||"");if(v.services?.[0])setQuantity(n=>Math.max(v.services[0].min,Math.min(v.services[0].max,n)))})
   .catch(e=>{if(!ctl.signal.aborted)setError(e.message)})
   .finally(()=>{if(!ctl.signal.aborted)setLoading(false)});
  return()=>ctl.abort();
 },[platform]);
 const estimate=activeService?activeService.per1000*Number(quantity)/1000:0;
 const handle=target.trim().replace(/^@/,"");
 const canPreviewProfile=platform==="instagram" ? /^(?!.*\\.\\.)(?!\\.)(?!.*\\.$)[a-zA-Z0-9._]{1,30}$/.test(handle) : /^[a-zA-Z0-9._]{2,24}$/.test(handle);
 const profilePreview=canPreviewProfile ? (platform==="instagram"?"https://www.instagram.com/"+handle+"/":"https://www.tiktok.com/@"+handle) : null;
 const valid=activeService&&Number.isSafeInteger(Number(quantity))&&quantity>=activeService.min&&quantity<=activeService.max&&Number.isSafeInteger(Number(posts))&&posts>=1&&posts<=60&&target.trim().length>1;
 async function request(path,body){const r=await fetch("/api/account/autolikes",{method:path==="POST"?"POST":"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Campaign update failed");return data}
 async function create(e){
  e.preventDefault();if(pending||!valid||!key)return;
  setPending(true);setError("");setNotice("");
  try{
   const v=await request("POST",{platform,serviceId,target:target.trim(),quantityPerPost:Number(quantity),maxPostsPerMonth:Number(posts),requestKey:key});
   setCampaigns(old=>[v.campaign,...old.filter(c=>c.id!==v.campaign.id)]);
   setNotice("Saved as a draft. No recurring payment or supplier delivery has started.");
   setKey(crypto.randomUUID());
  }catch(e){setError(e.message)}finally{setPending(false)}
 }
 async function update(c,action){
  if(pending)return;setPending(true);setError("");setNotice("");
  try{
   const v=await request("PATCH",{id:c.id,action});
   setCampaigns(old=>old.map(x=>x.id===c.id?v.campaign:x));
   setNotice(action==="cancel"?"Draft discarded. No subscription was charged.":"Draft updated without starting a subscription.");
  }catch(e){setError(e.message)}finally{setPending(false)}
 }
 return <section style={{background:"#10283e",border:"1px solid #437593",borderRadius:20,padding:"clamp(15px,4vw,24px)",display:"grid",gap:18}}>
  <div>
   <div style={{fontWeight:800,color:"#80cdf9",fontSize:12,letterSpacing:2}}>AUTOLIKES CAMPAIGNS</div>
   <h2 style={{fontSize:26,margin:"9px 0"}}>Prepare your monthly growth campaign</h2>
   <p style={{lineHeight:1.6,color:"#c5d8e6"}}>Create and edit saved plans using actual SMMGLOB Instagram or TikTok Likes services. Campaign drafts are free to prepare. <strong>Automatic renewals and deliveries are not enabled yet.</strong></p>
  </div>
  <form onSubmit={create} style={{display:"grid",gap:14}}>
   <label style={{display:"grid",gap:7}}>Social platform<select style={controls} value={platform} onChange={e=>setPlatform(e.target.value)}><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></label>
   <label style={{display:"grid",gap:7}}>Supplier-backed Likes service<select style={controls} value={serviceId} onChange={e=>{setServiceId(e.target.value);let s=services.find(x=>x.id===e.target.value);if(s)setQuantity(Math.max(s.min,Math.min(s.max,quantity)))}}>{services.length?services.map(s=><option key={s.id} value={s.id}>{s.name} — #{s.id} — {money(s.per1000)} / 1,000</option>):<option value="">No verified Likes services available</option>}</select></label>
   {activeService&&<div style={{fontSize:13,color:"#bfd6e6"}}>Service #{activeService.id} · {activeService.min.toLocaleString()}–{activeService.max.toLocaleString()} likes per post · {activeService.refill?"Refill available":"No refill stated"}</div>}
   <label style={{display:"grid",gap:7}}>Public profile username<input style={controls} value={target} onChange={e=>setTarget(e.target.value)} spellCheck={false} autoCapitalize="none" autoComplete="off" placeholder={platform==="instagram"?"@your.instagram":"@yourtiktok"} required/></label>
   {profilePreview&&<a href={profilePreview} target="_blank" rel="noopener noreferrer" style={{color:"#8fdafa",fontSize:13}}>Open public profile to check visibility (not automatically verified)</a>}
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14}}>
    <label style={{display:"grid",gap:7}}>Likes per new post<input style={controls} type="number" inputMode="numeric" min={activeService?.min||1} max={activeService?.max||100000} value={quantity} onChange={e=>setQuantity(Number(e.target.value))} required/></label>
    <label style={{display:"grid",gap:7}}>Maximum posts per month<input style={controls} type="number" inputMode="numeric" min="1" max="60" value={posts} onChange={e=>setPosts(Number(e.target.value))} required/></label>
   </div>
   {activeService&&<div style={{padding:15,border:"1px solid #375e7a",borderRadius:12,background:"#071d2d"}}>
    <strong>Planning estimate: {money(estimate)} per post</strong>
    <div style={{color:"#9ac1d7",fontSize:13,marginTop:5}}>At the selected maximum: {money(estimate*posts)} in one-time service value. This is not a subscription quote or a charge.</div>
   </div>}
   <button type="submit" disabled={pending||loading||!valid||!key} style={{...primary,opacity:(pending||loading||!valid)?0.55:1}}>{pending?"Saving draft…":"Save campaign draft — no payment"}</button>
  </form>
  {loading&&<div role="status">Checking available services…</div>}
  {error&&<p style={{color:"#ffc7c7",padding:12,background:"#482438",borderRadius:12}} role="alert">{error}</p>}
  {notice&&<p style={{color:"#bafad9",padding:12,background:"#164435",borderRadius:12}} role="status">{notice}</p>}
  <div>
   <h3 style={{fontSize:20}}>Your saved AutoLikes plans</h3>
   {!campaigns.length?<p style={{color:"#a9bfce"}}>No drafts yet.</p>:<div style={{display:"grid",gap:12}}>{campaigns.map(c=><article key={c.id} style={{border:"1px solid #3a6681",borderRadius:13,padding:15,background:"#091e2e"}}>
    <div style={{fontWeight:700,overflowWrap:"anywhere"}}>{c.platform.toUpperCase()} — {c.target}</div>
    <div style={{fontSize:13,color:"#bdcfde",marginTop:5}}>{c.quantityPerPost.toLocaleString()} likes/post · up to {c.maxPostsPerMonth} posts/month · Service #{c.serviceId}</div>
    <p style={{fontSize:13,color:"#b5dafa"}}>Status: <b>{c.status}</b> · {["draft","paused","cancelled"].includes(c.status)?"No active billing":"Contact support to verify billing"}</p>
    {["draft","paused"].includes(c.status)&&<div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
     <button style={secondary} type="button" disabled={pending} onClick={()=>update(c,c.status==="draft"?"pause":"resume")}>{c.status==="draft"?"Pause draft":"Resume editing"}</button>
     <button style={secondary} type="button" disabled={pending} onClick={()=>update(c,"cancel")}>Discard draft</button>
    </div>}
   </article>)}</div>}
  </div>
 </section>;
}
