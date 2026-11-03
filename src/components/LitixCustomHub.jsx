"use client";
import {useEffect,useMemo,useState} from "react";
import SocialMultiPostChooser from "./SocialMultiPostChooser";
import {newTikTokPost} from "./TikTokMultiPostChooser";
import {customQuote,customLineCents,CUSTOM_DRAFT_PREFIX} from "../lib/customQuote.mjs";

// These four public IDs map to approved Litix Default services. Live rates,
// quantity limits and purchase eligibility always come from the checkout catalog.
export const CUSTOM_PRODUCTS=Object.freeze([
 {platform:"Instagram",kind:"likes",id:"litix_4751",title:"Instagram Custom Likes",
  blurb:"Choose public Instagram posts or Reels, and divide your likes across up to five posts.",
  button:"Review Instagram Likes Order",detail:"Up to five posts · one payment · private tracking"},
 {platform:"Instagram",kind:"followers",id:"litix_5461",title:"Instagram Custom Followers",
  blurb:"Customize follower quantity for one public Instagram profile.",
  button:"Review Instagram Followers Order",detail:"Public profile · adjustable quantity · no password"},
 {platform:"TikTok",kind:"likes",id:"litix_5251",title:"TikTok Custom Likes",
  blurb:"Select up to five public TikTok videos, including supported share links.",
  button:"Review TikTok Likes Order",detail:"Up to five videos · one payment · private tracking"},
 {platform:"TikTok",kind:"followers",id:"litix_5101",title:"TikTok Custom Followers",
  blurb:"Choose an exact follower quantity for one public TikTok account.",
  button:"Review TikTok Followers Order",detail:"Public profile · adjustable quantity · no password"}
]);
export function customProductLink(product){
 return "/?service="+encodeURIComponent(product.id)+(product.kind==="likes"?"&mode=multi":"")+"#checkout";
}
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const presets=[100,250,500,1000,2500,5000,10000];

export default function LitixCustomHub(){
 const [platform,setPlatform]=useState("Instagram");
 const [kind,setKind]=useState("likes");
 const [liveService,setLiveService]=useState(null);
 const [loading,setLoading]=useState(true);
 const [catalogNote,setCatalogNote]=useState("");
 const [retry,setRetry]=useState(0);
 const [quantity,setQuantity]=useState(0);
 const [posts,setPosts]=useState([]);
 const [pickerOpen,setPickerOpen]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search);
  if(p.get("platform")==="tiktok")setPlatform("TikTok");
  if(p.get("kind")==="followers")setKind("followers");
 },[]);
 const product=CUSTOM_PRODUCTS.find(p=>p.platform===platform&&p.kind===kind);
 useEffect(()=>{
  const controller=new AbortController();
  setLiveService(null);setLoading(true);setCatalogNote("");setNotice("");
  setPosts([]);setQuantity(0);setPickerOpen(false);
  const q=new URLSearchParams({platform});
  fetch("/api/catalog/checkout-choices?"+q,{signal:controller.signal,cache:"no-store"})
   .then(async r=>{
    const d=await r.json();if(!r.ok)throw Error(d.error||"Live prices temporarily unavailable");
    return d;
   })
   .then(d=>{
    if(controller.signal.aborted)return;
    const match=(Array.isArray(d.items)?d.items:[]).find(s=>
     s.id===product.id&&s.platform===platform&&s.kind===kind&&s.purchasable===true&&
     Number.isFinite(Number(s.per1000))&&Number(s.per1000)>0&&
     Number.isSafeInteger(Number(s.min))&&Number(s.min)>0&&
     Number.isSafeInteger(Number(s.max))&&Number(s.max)>=Number(s.min));
    if(!match)throw Error("This Litix service is temporarily unavailable; no charge attempted.");
    setLiveService(match);
    setQuantity(Number(match.min));
    setPosts(kind==="likes"?[newTikTokPost({quantity:Number(match.min)})]:[]);
    setCatalogNote(d.liveAvailability===true?
     "Rate loaded from Litix's current supplier-backed catalog. Checkout verifies it again before payment.":
     "Price from the recently verified catalog. Checkout verifies current price and availability before payment.");
    setLoading(false);
   })
   .catch(error=>{
    if(controller.signal.aborted)return;
    setLiveService(null);setLoading(false);setCatalogNote(String(error?.message||"Prices unavailable").slice(0,190));
   });
  return()=>controller.abort();
 },[platform,kind,product.id,retry]);
 const quote=useMemo(()=>customQuote(liveService,kind,quantity,posts),[liveService,kind,quantity,posts]);
 const step=Number(liveService?.unitStep||1);
 const minimum=Number(liveService?.min||0),maximum=Number(liveService?.max||0);
 const quantities=[...new Set([minimum,...presets])].filter(q=>q>=minimum&&q<=maximum&&(q-minimum)%step===0&&customLineCents(liveService?.per1000,q)>=100);
 const count=kind==="likes"?posts.length:1;
 const allVerified=kind==="likes"&&posts.length>=1&&posts.length<=5&&posts.every(p=>
  p.status==="verified"&&Boolean(p.verifiedUrl)&&p.verifiedInput===String(p.link||"").trim())&&
  new Set(posts.map(p=>p.verifiedUrl)).size===posts.length;
 const checkoutHref=kind==="followers"&&quote.valid?
  customProductLink(product).replace("#checkout","&quantity="+encodeURIComponent(quantity)+"#checkout"):
  customProductLink(product);
 function prepareCheckout(event){
  if(!quote.valid){event.preventDefault();setNotice("Choose an allowed quantity for every post and try again.");return}
  if(kind==="followers")return; // URL carries the calculated quantity to existing secure checkout.
  event.preventDefault();
  try{
   const id=crypto.randomUUID();
   const payload={
    version:1,createdAt:Date.now(),serviceId:product.id,kind:"likes",
    posts:posts.map(p=>({
     link:String(p.link||"").trim(),quantity:Number(p.quantity),
     verifiedInput:String(p.verifiedInput||""),verifiedUrl:String(p.verifiedUrl||"")
    }))
   };
   sessionStorage.setItem(CUSTOM_DRAFT_PREFIX+id,JSON.stringify(payload));
   window.location.assign(customProductLink(product).replace("#checkout","&draft="+encodeURIComponent(id)+"#checkout"));
  }catch{
   setNotice("Your browser could not retain the post selections. Open secure checkout to choose the posts there; no payment has been attempted.");
  }
 }
 return <div className="litix-custom-hub">
   <div className="litix-custom-intro">
     <span className="kicker">CUSTOMIZE IN SECONDS · LIVE USD ESTIMATES</span>
     <h1>Custom Likes &amp; Followers</h1>
     <p>Select your platform, enter any quantity, and see your estimated cost instantly. For Likes, choose up to five posts before completing one secure checkout.</p>
   </div>
   <div className="litix-choice-panel" role="group" aria-label="Customize your Litix order">
     <div className="litix-choice-row">
       <strong>01 · Platform</strong>
       <div className="litix-segments" role="group" aria-label="Platform">
        {["Instagram","TikTok"].map(value=><button key={value} type="button" className={platform===value?"active":""}
          aria-pressed={platform===value} onClick={()=>setPlatform(value)}>{value}</button>)}
       </div>
     </div>
     <div className="litix-choice-row">
       <strong>02 · Service</strong>
       <div className="litix-segments" role="group" aria-label="Service type">
        {[["likes","Likes"],["followers","Followers"]].map(([value,label])=><button key={value} type="button"
         className={kind===value?"active":""} aria-pressed={kind===value} onClick={()=>setKind(value)}>{label}</button>)}
       </div>
     </div>
   </div>
   <article className="litix-custom-result" aria-live="polite">
    <div className="litix-custom-result-top">
     <span className="kicker">{product.platform.toUpperCase()} / {product.kind.toUpperCase()}</span>
     <span className="litix-result-status">{loading?"Checking current prices":liveService?"Available for checkout":"Check availability"}</span>
    </div>
    <h2>{product.title}</h2>
    <p>{product.blurb}</p>
    {loading&&<p role="status">Loading verified Litix rates and quantity limits…</p>}
    {!loading&&!liveService&&<div className="litix-custom-rate-error" role="alert">
      <p>{catalogNote}</p>
      <button type="button" className="alt" onClick={()=>setRetry(n=>n+1)}>Retry prices</button>
     </div>}
    {liveService&&<div className="litix-custom-calculator" aria-label="Live Litix custom price calculator">
     <div className="litix-custom-rate">
      <div><small>Current retail rate</small>
       <strong>{money(Math.ceil(Number(liveService.per1000)*100-1e-8))} <span>/ 1,000 {kind}</span></strong>
      </div>
      <div><small>Allowed quantity</small><strong>{minimum.toLocaleString()} – {maximum.toLocaleString()}</strong></div>
     </div>
     {kind==="followers"?<div className="litix-custom-quantity">
       <label htmlFor="litix-custom-followers-quantity">03 · Choose follower quantity</label>
       <input id="litix-custom-followers-quantity" type="number" inputMode="numeric"
        min={minimum} max={maximum} step={step} value={quantity||""}
        onChange={e=>setQuantity(e.target.value===""?0:Number(e.target.value))}/>
       <div className="litix-custom-presets" role="group" aria-label="Quick follower quantities">
        {quantities.slice(0,7).map(n=><button key={n} type="button" className={quantity===n?"selected":""}
         aria-pressed={quantity===n} onClick={()=>setQuantity(n)}>{n.toLocaleString()}</button>)}
       </div>
       <p className="small">You'll enter the public {platform} profile at secure checkout. No password needed.</p>
      </div>:<div className="litix-custom-quantity">
       <div className="litix-custom-row">
        <strong>03 · Select your posts or videos</strong>
        <span>{count} of 5 selected</span>
       </div>
       <div className="litix-custom-presets" role="group" aria-label="Likes for every selected post">
        {quantities.slice(0,7).map(n=><button key={n} type="button"
         aria-label={n.toLocaleString()+" likes per post"}
         onClick={()=>setPosts(old=>old.map(p=>({...p,quantity:n})))}>{n.toLocaleString()}</button>)}
       </div>
       <p className="small">Quick amounts set the same number of likes per post. Open the post picker to give each post a different quantity.</p>
       <button type="button" className="litix-picker-expand" aria-expanded={pickerOpen} aria-controls="litix-hub-post-picker"
        onClick={()=>setPickerOpen(x=>!x)}>
        {pickerOpen?"Hide post picker":"Choose your posts (up to 5)"} <span aria-hidden="true">{pickerOpen?"−":"+"}</span>
       </button>
       {pickerOpen&&<div id="litix-hub-post-picker">
        <SocialMultiPostChooser service={liveService} platform={platform.toLowerCase()} posts={posts} onChange={setPosts}/>
       </div>}
       <div className="litix-custom-post-summary">
        <div><strong>{count} {count===1?"post":"posts"}</strong><span>{quote.valid?quote.quantity.toLocaleString()+" total likes":"Select valid quantities"}</span></div>
        {quote.valid&&quote.lines.map((line,i)=><div key={i}><span>Post {i+1} · {line.quantity.toLocaleString()} likes</span><strong>{money(line.cents)}</strong></div>)}
       </div>
      </div>}
     <div className="litix-custom-estimate" aria-live="polite" role="status">
      <div><small>Estimated total · USD</small><strong>{quote.valid?money(quote.totalCents):"Choose a valid quantity"}</strong></div>
      <span>{kind==="likes"?"One payment for all selected posts":"One-time payment"}</span>
     </div>
     <p className="litix-custom-fine">{catalogNote}</p>
     {quote.valid?<a className="litix-metal-cta" href={checkoutHref} onClick={prepareCheckout}>
      {product.button} <span aria-hidden="true">›</span>
     </a>:<p className="litix-custom-warning" role="alert">Each selection must meet its supplier quantity limits and the $1 minimum per post. No payment attempted.</p>}
     {kind==="likes"&&!allVerified&&<p className="litix-custom-fine">
      You can select and verify posts here or finish choosing them at checkout. Checkout requires each public post link to be verified before payment.
     </p>}
     {notice&&<p role="alert" className="litix-custom-warning">{notice} <a href={customProductLink(product)}>Open checkout</a></p>}
    </div>}
    <p className="litix-custom-fine">Live rate previews are estimates. PayKings charges only the final server-verified total after you review the order. No order starts until payment is submitted.</p>
   </article>
   <div className="litix-custom-support-links">
     <a href="/shop">Explore more services</a>
     <a href="/bundles">View Growth Bundles</a>
     <a href="/track">Track an order</a>
   </div>
   <details className="litix-compact-details">
    <summary>How does ordering work?</summary>
    <ol>
     <li>Choose Instagram or TikTok and Likes or Followers.</li>
     <li>See your estimated price update whenever quantities change.</li>
     <li>For Likes, select up to five public posts or videos and customize each amount.</li>
     <li>Review the live-verified total at secure checkout, pay once, and save your tracking link.</li>
    </ol>
    <p>We never ask for social passwords. Supplier delivery speeds and refill eligibility vary; unverified orders are not silently repurchased.</p>
   </details>
 </div>;
}
