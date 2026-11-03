import LitixCustomHub from "../../components/LitixCustomHub";

export const metadata={
 title:"Custom Likes & Followers | Instagram & TikTok | Litix",
 description:"Build a custom Instagram or TikTok Likes and Followers order. Choose quantities, select public post links, and check out securely.",
 alternates:{canonical:"https://www.litix.net/custom-likes"}
};

export default function CustomLikesAndFollowersPage(){
 return <main className="wrap">
  <nav className="nav litix-streamlined-nav" aria-label="Litix Custom Likes and Followers navigation">
   <a href="/" className="brand" aria-label="Litix home">
    <img src="/assets/brand/litix-logo.webp" className="litix-new-logo" alt="Litix — Innovation, Ignited."/>
   </a>
   <div>
    <a href="/">Home</a>
    <a href="/shop">Shop</a>
    <a href="/custom-orders">Custom Orders</a>
    <a href="/bundles">Bundles</a>
    <a href="/track">Track Order</a>
   </div>
  </nav>
  <LitixCustomHub/>
 </main>;
}
