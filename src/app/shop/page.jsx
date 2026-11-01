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
   <a href="/services">Explore all Litix services</a>
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
   <h2>Already purchased?</h2>
   <p>Check your existing order without purchasing again or sharing a social password.</p>
   <a href="/track">Track your Litix order</a>
  </section>
 </main>;
}
