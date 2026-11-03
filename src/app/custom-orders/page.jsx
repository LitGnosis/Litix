import LitixDirectory from "../../components/LitixDirectory";

export const metadata = {
  title: "Custom Orders | Litix",
  description: "Choose your platform and customize a Litix social media service order with transparent quantities and secure checkout."
};

export default function CustomOrdersPage() {
  return (
    <main className="wrap">
      <nav className="nav" aria-label="Custom Orders navigation">
        <a className="brand" href="/" aria-label="Litix home">
          <img src="/assets/brand/litix-logo.webp" alt="Litix — Innovation, Ignited." className="litix-new-logo" />
        </a>
        <div>
          <a href="/">Home</a>
          <a href="/shop">Shop by Platform</a>
          <a href="/services">All Litix Services</a>
        <a href="/custom-likes">Custom Likes</a>
          <a href="/#checkout">PayKings Checkout</a>
          <a href="/track">Track Order</a>
        </div>
      </nav>
      <section className="panel" aria-labelledby="custom-orders-title">
        <h1 id="custom-orders-title">Custom Orders</h1>
        <p>Select Instagram, TikTok, YouTube, X or another available platform, then choose your service and quantity. Review the details before secure checkout.</p>
        <p><a className="primary" style={{display:"inline-flex",padding:"12px 20px",textDecoration:"none"}} href="/custom-likes">Custom Likes — Choose Your Instagram or TikTok Posts</a></p>
      </section>
      <LitixDirectory standalone />
    </main>
  );
}
