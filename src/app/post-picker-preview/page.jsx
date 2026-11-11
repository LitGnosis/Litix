"use client";
import {useMemo,useState} from "react";
import {divideLikes} from "../../lib/postPicker.mjs";
import "./post-picker.css";

export default function PostPickerPreview(){
  const [platform,setPlatform]=useState("instagram");
  const [username,setUsername]=useState("");
  const [account,setAccount]=useState("");
  const [posts,setPosts]=useState([]);
  const [selected,setSelected]=useState([]);
  const [quantity,setQuantity]=useState(300);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [review,setReview]=useState(false);
  const allocation=useMemo(()=>divideLikes(Number(quantity),selected.length),[quantity,selected.length]);
  const byUrl=new Map(posts.map(p=>[p.url,p]));
  function changePlatform(value){setPlatform(value);setAccount("");setPosts([]);setSelected([]);setReview(false);setMessage("");}
  async function lookup(event){
    event.preventDefault();if(busy)return;
    setBusy(true);setPosts([]);setSelected([]);setReview(false);setMessage("");
    try{
      const params=new URLSearchParams({platform,username:username.trim()});
      const r=await fetch("/api/post-picker?"+params.toString(),{cache:"no-store"});
      const data=await r.json();
      if(!r.ok)throw Error(data.error||"Couldn't load public posts.");
      setAccount(data.username||"");setPosts(data.posts||[]);setMessage(data.message||"");
    }catch(error){setMessage(String(error.message||"Public posts unavailable."))}
    finally{setBusy(false)}
  }
  function toggle(url){
    setReview(false);
    setSelected(current=>current.includes(url)?current.filter(x=>x!==url):current.length<8?[...current,url]:current);
  }
  return <main className="lpp-shell">
    <nav className="lpp-nav"><a href="/" className="lpp-wordmark">LITIX</a><a href="/">Back to Litix</a></nav>
    <header className="lpp-header">
      <div className="lpp-eyebrow">LITIX · CUSTOM LIKES · FEATURE PREVIEW</div>
      <h1>Choose Your Posts</h1>
      <p>Find your public posts, tap to select three or more, and preview the likes allocation — no copied post URLs needed.</p>
    </header>
    <section className="lpp-panel">
      <div className="lpp-platform" role="group" aria-label="Select social platform">
        <button type="button" aria-pressed={platform==="instagram"} onClick={()=>changePlatform("instagram")}>Instagram</button>
        <button type="button" aria-pressed={platform==="tiktok"} onClick={()=>changePlatform("tiktok")}>TikTok</button>
      </div>
      <form className="lpp-form" onSubmit={lookup}>
        <label htmlFor="lpp-username">Your public {platform==="instagram"?"Instagram":"TikTok"} username or profile link</label>
        <div className="lpp-search"><input id="lpp-username" value={username} onChange={e=>setUsername(e.target.value)}
          placeholder={platform==="instagram"?"@yourinstagram":"@yourtiktok"} autoComplete="off" autoCapitalize="none" spellCheck={false} required />
          <button type="submit" disabled={busy}>{busy?"Finding posts…":"Show my posts"}</button></div>
      </form>
      {message&&<p role="status" className="lpp-message">{message}</p>}
      {posts.length>0&&<>
        <div className="lpp-grid-head"><h2>@{account}</h2><span>{selected.length} / 8 selected</span></div>
        <div className="lpp-grid" role="group" aria-label="Choose multiple posts">
          {posts.map((post,i)=><button type="button" key={post.url} className={"lpp-post"+(selected.includes(post.url)?" lpp-picked":"")}
            aria-label={"Select post "+(i+1)} aria-pressed={selected.includes(post.url)} onClick={()=>toggle(post.url)}>
            <img src={post.thumbnail} alt={post.caption||"Public post thumbnail"} loading="lazy" referrerPolicy="no-referrer" />
            <span className="lpp-check" aria-hidden="true">{selected.includes(post.url)?"✓":""}</span>
            <span className="lpp-type">{post.kind}</span>
          </button>)}
        </div>
      </>}
    </section>
    {selected.length>0&&<section className="lpp-panel lpp-summary">
      <div className="lpp-grid-head"><h2>Likes allocation</h2><span>{selected.length} posts</span></div>
      <label htmlFor="lpp-quantity">Total likes across selected posts</label>
      <input id="lpp-quantity" type="number" min={selected.length} max="1000000" step="1"
        value={quantity} onChange={e=>{setQuantity(e.target.value);setReview(false)}}/>
      {allocation?<p className="lpp-help">Automatically divided as evenly as possible. Supplier minimums and final pricing must be verified before a real checkout.</p>:<p className="lpp-message">Enter a whole-number total of at least {selected.length} likes.</p>}
      {selected.map((url,i)=><div className="lpp-allocation" key={url}>
        <img src={byUrl.get(url)?.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>
        <div><strong>Post {i+1}</strong><span>{allocation?allocation[i].toLocaleString():"—"} likes</span></div>
        <a href={url} target="_blank" rel="noopener noreferrer">View post</a>
      </div>)}
      <button className="lpp-review" disabled={!allocation} type="button" onClick={()=>setReview(true)}>Review selected posts</button>
      {review&&<p role="status" className="lpp-message">Your {selected.length} posts are selected. This is a no-charge preview; payment and Boostero submission stay disabled until the per-post fulfillment flow is verified.</p>}
    </section>}
    <footer className="lpp-footer">Litix preview only · Public posts only · No social media password required · No charges or supplier orders</footer>
  </main>;
}
