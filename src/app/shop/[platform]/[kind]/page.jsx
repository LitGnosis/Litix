import {notFound} from "next/navigation";
import LitixDirectory from "../../../../components/LitixDirectory";
import {SHOP_CATEGORIES,shopCategory} from "../../../../lib/litixShopRoutes.mjs";

export const dynamicParams=false;
export function generateStaticParams(){
 return SHOP_CATEGORIES.map(item=>({platform:item.slug,kind:item.kind}));
}
export async function generateMetadata({params}){
 const {platform,kind}=await params;
 const selected=shopCategory(platform,kind);
 if(!selected)return {title:"Litix Services"};
 const title=selected.platformLabel+" "+selected.kindLabel+" | Shop Litix";
 const description="Compare currently available "+selected.platformLabel+" "+selected.kindLabel.toLowerCase()+
  " services with transparent prices, secure Litix checkout, and private order tracking.";
 return {title,description,alternates:{canonical:"https://www.litix.net"+selected.href}};
}
export default async function ShopCategoryPage({params}){
 const {platform,kind}=await params;
 const selected=shopCategory(platform,kind);
 if(!selected)notFound();
 const siblings=SHOP_CATEGORIES.filter(s=>s.slug===selected.slug);
 return <main className="wrap">
  <nav className="nav" aria-label="Litix shopping navigation">
   <a className="brand" href="/" aria-label="Litix home">
    <img src="/assets/brand/litix-logo.webp" className="litix-new-logo" alt="Litix" />
   </a>
   <div><a href="/shop">Shop by Platform</a><a href="/services">All Litix Services</a><a href="/bundles">Bundles</a><a href="/track">Track Order</a></div>
  </nav>
  <section className="panel" aria-labelledby="litix-shop-title">
   <div className="kicker">LITIX · {selected.platformLabel.toUpperCase()}</div>
   <h1 id="litix-shop-title">{selected.platformLabel} {selected.kindLabel}</h1>
   <p>Browse live-approved options and compare the price per 1,000, quantity limits, and total before you pay.
    Select any available service below to reach the existing secure checkout. No social media password required.</p>
   <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:14}}>
    <a href="#all-litix-services">Browse {selected.kindLabel}</a>
    <a href="/track">Track an order</a>
    <a href="/services">Explore every service</a>
   </div>
   <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:18}} aria-label={"More "+selected.platformLabel+" services"}>
    {siblings.map(item=><a key={item.href} href={item.href} aria-current={item.href===selected.href?"page":undefined}
     style={{padding:"8px 12px",border:"1px solid currentColor",borderRadius:12}}>{item.kindLabel}</a>)}
   </div>
  </section>
  <LitixDirectory standalone initialPlatform={selected.platform} initialKind={selected.kind}/>
 </main>;
}
