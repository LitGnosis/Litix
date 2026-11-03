import LitixDirectory from "../../components/LitixDirectory";
export const metadata={title:"All Litix Services | Litix",description:"Explore all Litix social media marketing services, organized by platform, category and retail pricing."};
export default function ServicesPage(){
 return <main className="wrap">
  <nav className="nav">
   <a className="brand" href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" alt="Litix — Innovation, Ignited." className="litix-new-logo" /></a>
   <div><a href="/">Home</a><a href="/shop">Shop by Platform</a><a href="/#checkout">Checkout</a><a href="/bundles">Growth Bundles</a><a href="/track">Track Order</a></div>
  </nav>
  <LitixDirectory standalone />
  <p className="small" style={{textAlign:"center",margin:"24px auto 60px"}}>LITIX · Analytics Amplified · Innovation Ignited · Metrics that Move</p>
 </main>;
}