"use client";
import {useState} from "react";
const initial={brand:"Litix",campaign:"original-content-launch",
 audience:"small business owners",pain:"creating consistent original social content",
 solution:"a direct content planning and production workflow",cta:"Learn more",
 landingUrl:"https://www.litix.net/direct-services"};
function sanitizePrompt(s){return String(s||"").replace(/[\\\"\n\r]/g," ").replace(/\s+/g," ").trim().slice(0,550)}
export default function ContentFarmStudio(){
 const [brief,setBrief]=useState(initial),[kit,setKit]=useState(null),[busy,setBusy]=useState(false),
 [notice,setNotice]=useState(""),[select,setSelect]=useState(0);
 async function generate(){
  setBusy(true);setNotice("");setKit(null);
  try{const r=await fetch("/api/direct-smm/creative-kit",{method:"POST",
   headers:{"content-type":"application/json"},cache:"no-store",body:JSON.stringify(brief)});
   const v=await r.json();if(!r.ok||!Array.isArray(v.kit?.variants)||v.kit.variants.length!==12||
    v.supplierApiCalled!==false||v.chargeAttempted!==false)throw Error("Litix could not verify the creative kit.");
   setKit(v.kit);setNotice("Litix generated twelve original drafts, ready for editorial review.");
  }catch(err){setNotice(err.message||"Creative service unavailable.")}finally{setBusy(false)}
 }
 const v=kit?.variants?.[select];
 const prompt=sanitizePrompt(v?(`${v.hook}. ${v.shotList}. Film for ${v.platform||"social video"}. ${brief.solution}. Visual brand: deep metallic blue, no misleading claims.`):
   `Original ${brief.brand} campaign creative for ${brief.audience}; ${brief.solution}; cinematic blue product marketing.`);
 const image=`openart generate image "${prompt}" -o ./litix-assets/`;
 const video=`openart generate video "${prompt}" -o ./litix-assets/`;
 async function copy(s){try{await navigator.clipboard.writeText(s);setNotice("Copied to clipboard.")}catch{setNotice("Copy manually from the text box.")}}
 return <section className="portal">
  <article className="panel"><p className="overline">01 / LITIX CREATIVE ENGINE</p><h2>Campaign input</h2>
   {Object.keys(initial).map(key=><label key={key}>{key.replace(/([A-Z])/g," $1").toUpperCase()}
    <input maxLength={key==="landingUrl"?500:180} value={brief[key]} onChange={e=>setBrief(x=>({...x,[key]:e.target.value}))}/></label>)}
   <button type="button" className="btn" disabled={busy} onClick={generate}>
    {busy?"Generating content…":"Generate 12 first-party creative drafts"}</button>
   <p className="muted">The Litix engine returns editable content; it does not create media assets, publish posts, or claim views.</p>
  </article>
  <article className="panel"><p className="overline">02 / OPTIONAL AI MEDIA RENDER</p><h2>OpenArt-ready production</h2>
    {kit?<><label>Choose one of 12 drafts<select value={select} onChange={e=>setSelect(Number(e.target.value))}>
      {kit.variants.map((x,i)=><option value={i} key={x.id}>{i+1} · {x.channel||x.platform} · {x.angleName}</option>)}</select></label>
      <p className="alert">{v?.caption}</p></>:<p>Generate the campaign first or edit the source brief to plan your media production.</p>}
    <label>Image generation CLI prompt<textarea readOnly rows={4} value={image}/></label>
    <button type="button" className="btn" onClick={()=>copy(image)}>Copy image command</button>
    <label>Video generation CLI prompt<textarea readOnly rows={4} value={video}/></label>
    <button type="button" className="btn" onClick={()=>copy(video)}>Copy video command</button>
    <p className="muted">OpenArt requires login via <code>openart login</code> and uses OpenArt credits; commands run in a terminal with a connected account, not automatically in visitors' browsers.</p>
    <p><a href="https://openart.ai/mcp/" rel="noreferrer" target="_blank">OpenArt MCP / CLI setup and account connection</a></p>
    <p className="muted">OpenArt media generation is optional. Litix-owned content planning and fulfillment do not depend on any outside SMM supplier.</p>
    {notice&&<p role="status">{notice}</p>}
  </article>
 </section>;
}
