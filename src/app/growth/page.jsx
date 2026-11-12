"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {CALENDAR_MAX_ENTRIES,CALENDAR_PLATFORMS,CALENDAR_STATUSES,CALENDAR_STORAGE_KEY,calendarCsv,monthGrid,restoreCalendarEntries,validateCalendarDraft} from "../../lib/growthCalendar.mjs";
import "./growth.css";

const today=()=>{
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const blank=(date=today())=>({title:"",date,platform:"Instagram",status:"Planned",note:""});
const formatDate=s=>new Date(s+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
export default function GrowthContentCalendar(){
  const now=new Date();
  const [month,setMonth]=useState({year:now.getFullYear(),index:now.getMonth()});
  const [entries,setEntries]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [draft,setDraft]=useState(blank);
  const [editId,setEditId]=useState("");
  const [notice,setNotice]=useState("");
  const [filter,setFilter]=useState("All");
  useEffect(()=>{
    try{setEntries(restoreCalendarEntries(window.localStorage.getItem(CALENDAR_STORAGE_KEY)));}
    catch{setNotice("Browser storage is unavailable. The calendar can be used temporarily, but changes may not persist.");}
    setLoaded(true);
  },[]);
  useEffect(()=>{
    if(!loaded)return;
    try{window.localStorage.setItem(CALENDAR_STORAGE_KEY,JSON.stringify(entries));}
    catch{setNotice("Your browser did not save the changes. Export a CSV copy before leaving.");}
  },[entries,loaded]);
  const days=useMemo(()=>monthGrid(month.year,month.index),[month.year,month.index]);
  const inMonth=useMemo(()=>entries.filter(e=>e.date.startsWith(`${month.year}-${String(month.index+1).padStart(2,"0")}-`)&&(filter==="All"||filter===e.platform)).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)),[entries,month.year,month.index,filter]);
  const byDate=useMemo(()=>{
    const grouped=new Map();
    for(const e of inMonth)grouped.set(e.date,[...(grouped.get(e.date)||[]),e]);
    return grouped;
  },[inMonth]);
  const totals=useMemo(()=>({
    planned:entries.filter(e=>e.status==="Planned").length,
    draft:entries.filter(e=>e.status==="Draft").length,
    published:entries.filter(e=>e.status==="Published").length,
  }),[entries]);
  const shiftMonth=delta=>setMonth(m=>{
    const d=new Date(m.year,m.index+delta,1);
    return {year:d.getFullYear(),index:d.getMonth()};
  });
  const chooseDay=date=>{
    setDraft(blank(date));setEditId("");setNotice("");
    document.getElementById("litix-calendar-editor")?.scrollIntoView({behavior:"smooth",block:"start"});
  };
  const edit=e=>{
    setDraft({title:e.title,date:e.date,platform:e.platform,status:e.status,note:e.note});setEditId(e.id);setNotice("");
    document.getElementById("litix-calendar-editor")?.scrollIntoView({behavior:"smooth",block:"start"});
  };
  const save=event=>{
    event.preventDefault();
    const v=validateCalendarDraft(draft);
    if(!v.ok){setNotice(v.error);return;}
    if(!editId&&entries.length>=CALENDAR_MAX_ENTRIES){setNotice("The local calendar holds up to 200 items. Export a CSV, then remove old entries to make space.");return;}
    const id=editId||crypto.randomUUID();
    setEntries(old=>editId?old.map(e=>e.id===editId?{id,...v.value}:e):[...old,{id,...v.value}]);
    const [year,index]=v.value.date.split("-").map(Number);
    setMonth({year,index:index-1});
    setDraft(blank(v.value.date));setEditId("");
    setNotice(editId?"Calendar item updated in this browser.":"Calendar item added in this browser.");
  };
  const remove=e=>{
    if(!window.confirm("Delete this local calendar item? This cannot be undone."))return;
    setEntries(old=>old.filter(x=>x.id!==e.id));
    if(editId===e.id){setEditId("");setDraft(blank());}
    setNotice("Item deleted from this browser.");
  };
  const exportCsv=()=>{
    const data=calendarCsv(entries);
    const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="litix-growth-calendar.csv";
    document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),2000);
    setNotice("CSV export prepared. Check your browser downloads.");
  };
  return <main className="lgrowth">
    <nav className="lgrowth-nav" aria-label="Growth OS navigation">
      <Link href="/" className="lgrowth-brand"><img src="/assets/brand/litix-logo.webp" width="126" height="40" alt="Litix home" /></Link>
      <div><Link href="/#growth-studio">Growth Studio</Link><Link href="/track">Track Order</Link><Link href="/global/en">Global</Link></div>
    </nav>
    <header className="lgrowth-hero">
      <div><p className="lgrowth-eyebrow">LITIX GROWTH OS</p><h1>Content Calendar</h1>
        <p>Plan your posts, keep captions organized, and export your content schedule. Your ideas stay in this browser—no social accounts or automation are connected.</p>
      </div>
      <button className="lgrowth-export" type="button" onClick={exportCsv} disabled={!entries.length}>Export CSV <span aria-hidden="true">↗</span></button>
    </header>
    <section className="lgrowth-metrics" aria-label="Content planning overview">
      <article><span>Scheduled</span><strong>{totals.planned}</strong></article>
      <article><span>Drafts</span><strong>{totals.draft}</strong></article>
      <article><span>Marked published</span><strong>{totals.published}</strong></article>
      <article><span>Saved locally</span><strong>{entries.length}<small> / {CALENDAR_MAX_ENTRIES}</small></strong></article>
    </section>
    <div className="lgrowth-body">
      <section className="lgrowth-panel lgrowth-calendar" aria-label="Monthly content schedule">
        <div className="lgrowth-toolbar">
          <div><p className="lgrowth-eyebrow">MONTHLY PLANNER</p><h2>{new Date(month.year,month.index,1).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</h2></div>
          <div className="lgrowth-controls">
            <label>Platform <select aria-label="Filter calendar by platform" value={filter} onChange={e=>setFilter(e.target.value)}><option value="All">All</option>{CALENDAR_PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></label>
            <button type="button" onClick={()=>shiftMonth(-1)} aria-label="Previous month">‹</button>
            <button type="button" onClick={()=>setMonth({year:new Date().getFullYear(),index:new Date().getMonth()})}>Today</button>
            <button type="button" onClick={()=>shiftMonth(1)} aria-label="Next month">›</button>
          </div>
        </div>
        <div className="lgrowth-weekdays" aria-hidden="true">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(w=><span key={w}>{w}</span>)}</div>
        <div className="lgrowth-grid">
          {days.map((date,i)=>!date?<div key={"empty-"+i} className="lgrowth-day lgrowth-empty" aria-hidden="true"/>:
            <div key={date} className={"lgrowth-day"+(date===today()?" lgrowth-today":"")}>
              <button type="button" className="lgrowth-day-number" onClick={()=>chooseDay(date)} aria-label={"Add content for "+formatDate(date)}>{Number(date.slice(-2))}<span aria-hidden="true"> +</span></button>
              {(byDate.get(date)||[]).slice(0,3).map(e=><button key={e.id} type="button" className="lgrowth-entry" onClick={()=>edit(e)} aria-label={"Edit "+e.title}><span>{e.platform}</span><b>{e.title}</b></button>)}
              {(byDate.get(date)||[]).length>3&&<span className="lgrowth-more">+{byDate.get(date).length-3} more</span>}
            </div>)}
        </div>
        <p className="lgrowth-help">Select a date to plan a post. Select a saved post to edit it. Statuses are your notes, not live social-platform delivery reports.</p>
      </section>
      <section id="litix-calendar-editor" className="lgrowth-panel lgrowth-editor" aria-label="Content planner editor">
        <p className="lgrowth-eyebrow">{editId?"EDIT CONTENT":"PLAN CONTENT"}</p><h2>{editId?"Update your plan":"Add a content idea"}</h2>
        <form onSubmit={save} className="lgrowth-form">
          <label>Content title<input required maxLength={100} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="Product launch reel" /></label>
          <label>Publish date<input type="date" required min="2000-01-01" max="2100-12-31" value={draft.date} onChange={e=>setDraft(d=>({...d,date:e.target.value}))} /></label>
          <label>Social platform<select value={draft.platform} onChange={e=>setDraft(d=>({...d,platform:e.target.value}))}>{CALENDAR_PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></label>
          <label>Status<select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}>{CALENDAR_STATUSES.map(p=><option key={p}>{p}</option>)}</select></label>
          <label>Caption or creative notes<textarea rows={7} maxLength={2000} value={draft.note} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} placeholder="Opening hook, caption, hashtags, call to action, shot list..." /></label>
          <div className="lgrowth-actions">
            <button type="submit" className="lgrowth-save">{editId?"Save changes":"Save to calendar"}</button>
            {editId&&<button type="button" className="lgrowth-cancel" onClick={()=>{setDraft(blank());setEditId("");setNotice("");}}>Cancel edit</button>}
          </div>
        </form>
        {notice&&<p className="lgrowth-notice" role="status" aria-live="polite">{notice}</p>}
        <p className="lgrowth-privacy"><b>Privacy and limitations:</b> Stored on this device only. Not synchronized across accounts, devices or agencies. Export regularly. Nothing here publishes to social media, charges payments, or makes supplier requests.</p>
      </section>
    </div>
    <section className="lgrowth-panel lgrowth-upcoming" aria-label="Saved content entries">
      <div className="lgrowth-toolbar"><div><p className="lgrowth-eyebrow">YOUR CONTENT</p><h2>Saved ideas and upcoming posts</h2></div><span>{entries.length} local items</span></div>
      {entries.length?<div className="lgrowth-upcoming-list">
        {[...entries].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)).map(e=><article className="lgrowth-upcoming-item" key={e.id}>
          <div><span className="lgrowth-date">{formatDate(e.date)} · {e.platform} · {e.status}</span><strong>{e.title}</strong>{e.note&&<p>{e.note}</p>}</div>
          <div className="lgrowth-item-actions"><button type="button" onClick={()=>edit(e)}>Edit</button><button type="button" onClick={()=>remove(e)} aria-label={"Delete "+e.title}>Delete</button></div>
        </article>)}
      </div>:<p className="lgrowth-help">Your calendar is empty. Select a day above or use the form to add your first campaign idea.</p>}
    </section>
    <footer className="lgrowth-footer"><span>Litix Growth OS · Original planning tools</span><Link href="/">Return to Litix</Link></footer>
  </main>;
}
