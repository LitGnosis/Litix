import {SHOP_CATEGORIES} from "../../lib/litixShopRoutes.mjs";
export const metadata={
 title:"Shop Social Media Services by Platform | Litix",
 description:"Browse Litix Instagram, TikTok, YouTube, X and Facebook services, then check live availability and prices before secure checkout.",
 alternates:{canonical:"https://www.litix.net/shop"}
};
export default function ShopIndex(){
 const platforms=[...new Set(SHOP_CATEGORIES.map(x=>x.platform))];
 return <main className="wrap">
  <nav className="nav" aria-label="Litix shopping navigation">
   <a className="brand" href="/" aria-label="Litix home">
    <img src="/assets/brand/litix-logo.webp" alt="Litix" className="litix-new-logo"/>
   </a>
   <div><a href="/services">All Litix Services</a><a href="/bundles">Growth Bundles</a><a href="/track">Track Order</a></div>
  </nav>
  <section className="panel" aria-labelledby="shop-head">
   <div className="kicker">LITIX · SHOP BY PLATFORM</div>
   <h1 id="shop-head">Choose a platform. Find your service.</h1>
   <p>Pick your social network and the result you want. Every category opens the actual Litix catalog, with prices and availability checked again at checkout.</p>
   <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:15}}><a className="primary" href="/custom-likes" style={{display:"inline-flex",alignItems:"center",textDecoration:"none"}}>Custom Likes &amp; Followers</a><a href="/services">Explore all Litix services</a></div>
  </section>
  {platforms.map(platform=>{
   const links=SHOP_CATEGORIES.filter(x=>x.platform===platform);
   return <section key={platform} className="panel" aria-label={links[0].platformLabel+" services"}>
    <h2>{links[0].platformLabel}</h2>
    <p>Select a category to compare available services, quantity limits and transparent pricing.</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
     {links.map(item=><a key={item.href} href={item.href}
      style={{padding:"12px 18px",border:"1px solid currentColor",borderRadius:12}}>
      {item.platformLabel} {item.kindLabel}</a>)}
    </div>
   </section>;
  })}
  <section className="panel">
   <h2>Free TikTok Creator Tools</h2>
   <p>Compare video engagement using your own public counts. No account, API connection or payment.</p>
   <a href="/tools/tiktok-engagement">Open free engagement calculator</a>
  </section>
  <section className="panel">
   <h2>Grow a business or creator brand</h2>
   <p>Explore Litix Local Growth, creator tools, content production and future agency solutions. Free tools work now; new service programs accept manual proposals rather than automatic payments.</p>
   <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
    <a href="/solutions">Business & Creator Growth Hub</a>
    <a href="/tools/local-visibility">Free Local Checklist</a>
   </div>
  </section>
  <section className="panel">
   <h2>Before you check out</h2>
   <p>Choose a supported service, review the final price and quantity, and use only the eligible public link requested. Never enter your social account password or pay again when an order is under review.</p>
   <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
     <a href="/#checkout">Continue to secure checkout</a>
     <a href="/terms">Review service terms</a>
     <a href="/track">Check an existing order</a>
   </div>
  </section>
  <section className="panel">
   <h2>Work with Litix</h2>
   <p>Agencies, creators and marketing professionals can apply for an individually reviewed partnership or referral pilot. No automatic commission or wholesale pricing is promised.</p>
   <a href="/partners">Explore partnership opportunities</a>
  </section>
  <section className="panel">
   <h2>Already purchased?</h2>
   <p>Check your existing order without purchasing again or sharing a social password.</p>
   <a href="/track">Track your Litix order</a>
  </section>
 </main>;
}
