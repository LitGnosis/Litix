"use client";
import {useEffect,useMemo,useState} from "react";
import {newTikTokPost} from "./TikTokMultiPostChooser";
import SocialMultiPostChooser from "./SocialMultiPostChooser";
import {customPublicCardValid,customPriceQuote,customRateCents,CUSTOM_MAX_POSTS} from "../lib/litixCustomCalculator.mjs";

const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents)/100);
const presets=[100,250,500,1000,2500,5000,10000];
const makePost=quantity=>newTikTokPost({quantity});
const storageKey="litix:custom-quote-v1";

export default function LitixCustomPriceCalculator({product}){
 const [card,setCard]=useState(null);
 const [state,setState]=useState("loading");
 const [message,setMessage]=useState("");
 const [retry,setRetry]=useState(0);
 const [posts,setPosts]=useState([]);
 const [followersQuantity,setFollowersQuantity]=useState(0);
 const likes=product.kind==="likes";
 useEffect(()=>{
  let current=true;const controller=new AbortController();
  setCard(null);setPosts([]);setFollowersQuantity(0);setState("loading");setMessage("");
  const params=new URLSearchParams({q:product.id,page:"1"});
  fetch("/api/catalog/v1?"+params,{signal:controller.signal,cache:"no-store"})
   .then(async response=>{
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Current prices are unavailable.");
    return data;
   })
   .then(data=>{
    if(!current)return;
    const service=(Array.isArray(data.items)?data.items:[]).find(x=>customPublicCardValid(x,product));
    if(!service)throw Error("This package is not currently available for secure checkout.");
    setCard(service);setFollowersQuantity(Number(service.min));
    setPosts([makePost(Number(service.min))]);
    setState("ready");
   })
   .catch(error=>{
    if(!current)return;
    setState("error");setMessage(String(error?.message||"Could not load current Litix prices.").slice(0,160));
   });
  return()=>{current=false;controller.abort()};
 },[product.id,retry]);
 const quantities=likes?posts.map(p=>Number(p.quantity)):[followersQuantity];
 const quote=useMemo(()=>card?customPriceQuote(card,quantities,product.kind):{valid:false,totalCents:null,totalUnits:0,lines:[]},
  [card,product.kind,followersQuantity,posts]);
 const rate=card?customRateCents(card):null;
 const valid=state==="ready"&&card&&quote.valid&&rate!==null;
 const checkoutHref=valid?
  "/?service="+encodeURIComponent(product.id)+
  (likes?"&mode=multi&posts="+posts.length+"&quantities="+posts.map(p=>encodeURIComponent(p.quantity)).join(","):
   "&quantity="+encodeURIComponent(followersQuantity))+
  (likes?"&customQuote=1":"")+"#checkout":null;
 const buttons=card?[...new Set([Number(card.min),...presets])]
   .filter(q=>q>=Number(card.min)&&q<=Number(card.max)&&(q-Number(card.min))%Number(card.unitStep||1)===0&&
     customPriceQuote(card,[q],product.kind).valid).slice(0,8):[];
 const saveChoice=()=>{
  if(!valid||!likes)return;
  try{
   const safe=posts.map(p=>({
    link:String(p.link||"").trim().slice(0,1100),
    quantity:Number(p.quantity),
    verifiedUrl:p.status==="verified"&&p.verifiedInput===String(p.link||"").trim()?String(p.verifiedUrl||"").slice(0,1100):""
   }));
   sessionStorage.setItem(storageKey,JSON.stringify({version:1,serviceId:product.id,savedAt:Date.now(),posts:safe}));
  }catch{/* Link still carries exact quantities; the checkout post picker remains available. */}
 };
 return <div className="litix-custom-calculator" aria-label={product.title+" price calculator"}>
  <div className="litix-calculator-heading">
   <strong>Instant Price Calculator</strong>
   <span>USD · No hidden quote</span>
  </div>
  {state==="loading"&&<p role="status" className="litix-calculator-status">Loading the current Litix price and quantity limits…</p>}
  {state==="error"&&<div className="litix-calculator-status" role="alert">
    <p>{message} No payment has been attempted.</p>
    <button className="alt" type="button" onClick={()=>setRetry(v=>v+1)}>Retry current price</button>
   </div>}
  {card&&rate!==null&&<div className="litix-calculator-content">
   <div className="litix-rate-line">
    <span>Rate <strong>{money(rate)} / 1,000</strong></span>
    <span>Minimum {Number(card.min).toLocaleString()} · Maximum {Number(card.max).toLocaleString()} per {likes?"post":"order"}</span>
   </div>
   {likes?<div className="litix-post-price-editor">
     <div className="litix-price-group-label"><strong>Likes per post</strong><span>Up to {CUSTOM_MAX_POSTS} public posts · one payment</span></div>
     {posts.map((post,i)=><div className="litix-post-price-row" key={post.id}>
       <label htmlFor={"litix-quantity-"+post.id}>Post {i+1}</label>
       <input id={"litix-quantity-"+post.id} aria-label={"Likes for post "+(i+1)}
        type="number" inputMode="numeric" min={card.min} max={card.max} step={card.unitStep||1}
        value={post.quantity} onChange={e=>setPosts(old=>old.map(p=>p.id===post.id?
         {...p,quantity:e.target.value===""?0:Number(e.target.value)}:p))}/>
       <strong>{quote.lines[i]!==undefined?money(quote.lines[i]):"—"}</strong>
       {posts.length>1&&<button type="button" className="litix-remove-post" aria-label={"Remove post "+(i+1)}
        onClick={()=>setPosts(old=>old.filter(p=>p.id!==post.id))}>×</button>}
     </div>)}
     <div className="litix-price-actions">
      {posts.length<CUSTOM_MAX_POSTS&&<button type="button" className="alt"
       onClick={()=>setPosts(old=>old.length>=CUSTOM_MAX_POSTS?old:[...old,makePost(Number(card.min))])}>
       + Add Post ({posts.length}/{CUSTOM_MAX_POSTS})
      </button>}
      {posts.length>1&&<button type="button" className="alt" onClick={()=>setPosts(old=>old.slice(0,1))}>Reset to one post</button>}
     </div>
    </div>:<label className="litix-followers-quantity">
     <strong>Choose followers</strong>
     <input type="number" inputMode="numeric" aria-label="Followers quantity"
      min={card.min} max={card.max} step={card.unitStep||1}
      value={followersQuantity} onChange={e=>setFollowersQuantity(e.target.value===""?0:Number(e.target.value))}/>
    </label>}
   <div className="litix-calculator-presets" role="group" aria-label="Quick quantity options">
    {buttons.map(n=><button key={n} type="button" aria-pressed={likes?posts.length===1&&posts[0]?.quantity===n:followersQuantity===n}
      onClick={()=>{if(likes)setPosts(old=>old.map(p=>({...p,quantity:n})));else setFollowersQuantity(n)}}>
      {n.toLocaleString()}</button>)}
   </div>
   {likes&&<details className="litix-compact-details litix-post-choose-details">
    <summary>Choose your posts now · Gallery or paste links</summary>
    <p className="small">Browse your public posts or paste verified Instagram/TikTok links. Choose up to five posts and set a different likes quantity for each. Your verified selections carry into checkout on this device.</p>
    <SocialMultiPostChooser service={card} platform={product.platform.toLowerCase()} posts={posts} onChange={setPosts}/>
   </details>}
   <div className="litix-calculator-total" aria-live="polite">
     <span>Estimated total for {likes?posts.length+" "+(posts.length===1?"post":"posts"):followersQuantity.toLocaleString()+" followers"}</span>
     <strong>{valid?money(quote.totalCents):"Check quantity"}</strong>
     {valid&&likes&&<small>{quote.totalUnits.toLocaleString()} likes distributed across {posts.length} {posts.length===1?"post":"posts"}</small>}
   </div>
   {!valid&&<p className="litix-calc-warning" role="alert">Each {likes?"post":"order"} must meet its minimum and maximum quantity, allowed increments and $1 minimum. Total likes cannot exceed 1,000,000.</p>}
   {checkoutHref?<a href={checkoutHref} className="litix-metal-cta litix-calculator-continue" onClick={saveChoice}>
     {likes?"Continue & Choose Your Posts":"Continue to Secure Checkout"}<span aria-hidden="true">›</span>
    </a>:<div className="litix-calc-disabled" aria-disabled="true">Choose a valid quantity to continue</div>}
   <p className="litix-custom-fine">Prices are calculated from the currently approved Litix catalog. The secure checkout independently verifies the final price and active supplier availability before any card charge.</p>
  </div>}
 </div>;
}
