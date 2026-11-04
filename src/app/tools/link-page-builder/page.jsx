"use client";
import {useState} from "react";
import Link from "next/link";
import {linkPageExport,safeCreatorUrl} from "../../../lib/litixCreatorTools.mjs";
import "../../solutions/solutions.css";
const fresh={name:"",tagline:"",links:[{label:"",url:""},{label:"",url:""},{label:"",url:""}]};
export default function LitixLinkPageBuilder(){
 const [data,setData]=useState(fresh),[notice,setNotice]=useState("");
 const set=(k,v)=>{setData(d=>({...d,[k]:v}));setNotice("")};
 const change=(idx,key,value)=>{setData(d=>({...d,links:d.links.map((x,i)=>i===idx?{...x,[key]:value}:x)}));setNotice("")};
 function download(){
  try{
   const html=linkPageExport(data);
   const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
   const anchor=document.createElement("a");anchor.href=url;anchor.download="litix-my-link-page.html";document.body.appendChild(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);setNotice("HTML export prepared. Upload it to a host you control to publish.");
  }catch(error){setNotice(error?.message||"Add a name and at least one valid URL.")}
 }
 return <main className="ls-main">
  <nav className="ls-nav"><Link className="ls-brand" href="/"><img src="/assets/brand/litix-logo.webp" width="126" height="68" alt="Litix home"/></Link><div><Link href="/solutions">Solutions</Link><Link href="/tools/caption-builder">Caption tool</Link></div></nav>
  <section className="ls-hero ls-detail-hero"><span className="ls-eyebrow">FREE · DOWNLOADABLE DEMO</span><h1>Creator Link Page Maker</h1><p>Create a lightweight link-in-bio web page with your name and public links. Preview it and export a standalone HTML file. Hosting, a login, custom domains and payment processing are not provided.</p></section>
  <div className="ls-detailgrid">
   <section className="ls-panel"><h2>Customize your link page</h2>
    <div className="ls-form">
     <label>Display name<input value={data.name} maxLength={80} onChange={e=>set("name",e.target.value)} placeholder="Your brand"/></label>
     <label>Short description<input value={data.tagline} maxLength={160} onChange={e=>set("tagline",e.target.value)} placeholder="What you create"/></label>
     {data.links.map((item,i)=><div className="ls-fields" key={i}>
      <label>Button {i+1} text<input maxLength={70} value={item.label} onChange={e=>change(i,"label",e.target.value)} placeholder="My website"/></label>
      <label>Public URL {i+1}<input type="url" inputMode="url" value={item.url} onChange={e=>change(i,"url",e.target.value)} placeholder="https://example.com"/></label>
     </div>)}
     <div className="ls-tool-actions">
      <button type="button" disabled={data.links.length>=5} onClick={()=>set("links",[...data.links,{label:"",url:""}])}>Add another link</button>
      <button type="button" onClick={download}>Export HTML</button>
     </div>
     <p role="status" aria-live="polite">{notice}</p>
    </div>
   </section>
   <section className="ls-panel">
    <h2>Live preview</h2>
    <div style={{border:"1px solid #65c6fb6c",borderRadius:18,padding:26,textAlign:"center",background:"linear-gradient(135deg,#061527,#164d70)"}}>
     <h3 style={{fontSize:30,margin:"5px 0"}}>{data.name||"Your brand"}</h3>
     <p style={{overflowWrap:"anywhere"}}>{data.tagline||"Your description goes here"}</p>
     {data.links.filter(x=>x.label&&safeCreatorUrl(x.url)).map((x,i)=><a key={i} href={safeCreatorUrl(x.url)} target="_blank" rel="noopener noreferrer nofollow" style={{display:"block",padding:13,background:"#143950",borderRadius:12,margin:"10px 0"}}>{x.label}</a>)}
    </div>
    <p className="ls-note">The preview is local to your browser. No user account is created and no personal information is sent to Litix.</p>
    <p><Link href="/solutions/linkstore">Ask about the future hosted Litix LinkStore pilot</Link>.</p>
   </section>
  </div>
 </main>;
}
