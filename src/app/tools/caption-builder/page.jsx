"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {buildCaptionIdeas,CAPTION_TONES,CAPTION_PLATFORMS} from "../../../lib/litixCreatorTools.mjs";
import "../../solutions/solutions.css";
const initial={business:"",audience:"",offer:"",action:"",tone:"Clear",platform:"Instagram"};
export default function LitixCaptionBuilder(){
 const [values,setValues]=useState(initial),[notice,setNotice]=useState("");
 const result=useMemo(()=>{try{return buildCaptionIdeas(values)}catch{return null}},[values]);
 const set=(k,v)=>{setValues(old=>({...old,[k]:v}));setNotice("")};
 async function copy(value){try{await navigator.clipboard.writeText(value);setNotice("Caption copied.")}catch{setNotice("Copy is unavailable; select the caption text manually.")}}
 return <main className="ls-main">
  <nav className="ls-nav"><Link className="ls-brand" href="/"><img src="/assets/brand/litix-logo.webp" width="126" height="68" alt="Litix home"/></Link><div><Link href="/solutions">Solutions</Link><Link href="/growth">Calendar</Link></div></nav>
  <section className="ls-hero ls-detail-hero"><span className="ls-eyebrow">FREE TOOL · NO LOGIN</span><h1>Caption & CTA Builder</h1><p>Turn a real business offer into three editable starting captions. This uses private, rule-based templates in your browser—no AI model, external profile scraping, or publishing access.</p></section>
  <section className="ls-panel ls-tool-panel"><h2>Describe your message</h2>
   <div className="ls-tool-fields">
    <label>Business or creator name <input maxLength={80} value={values.business} onChange={e=>set("business",e.target.value)} placeholder="e.g. Elm Street Bakery"/></label>
    <label>Audience <input maxLength={110} value={values.audience} onChange={e=>set("audience",e.target.value)} placeholder="e.g. Dallas coffee lovers"/></label>
    <label>Offer or message <textarea rows={3} maxLength={170} value={values.offer} onChange={e=>set("offer",e.target.value)} placeholder="e.g. a weekend tasting event"/></label>
    <label>Call to action <input maxLength={110} value={values.action} onChange={e=>set("action",e.target.value)} placeholder="e.g. Reserve a spot on our site"/></label>
    <label>Social platform <select value={values.platform} onChange={e=>set("platform",e.target.value)}>{CAPTION_PLATFORMS.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
    <label>Tone <select value={values.tone} onChange={e=>set("tone",e.target.value)}>{CAPTION_TONES.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
   </div>
   <h2 style={{marginTop:30}}>Your caption ideas</h2>
   {result?result.map(item=><article className="ls-tool-result" key={item.label}><strong>{item.label}</strong><p>{item.text}</p><div className="ls-tool-actions"><button type="button" onClick={()=>copy(item.text)}>Copy caption</button></div></article>):<p className="ls-note">Fill in the four message fields to see caption drafts.</p>}
   <p role="status" aria-live="polite">{notice}</p><p className="ls-note">Review facts, rights, accuracy, and platform rules before publishing. Litix does not guarantee reach or engagement.</p>
  </section>
  <section className="ls-panel ls-tool-panel"><h2>Want a full content plan?</h2><p><Link href="/growth">Use the existing Litix content calendar</Link> or <Link href="/solutions/local">request small-business marketing help</Link>.</p></section>
 </main>;
}
