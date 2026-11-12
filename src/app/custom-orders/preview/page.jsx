"use client";
import LitixDirectory from "../../../components/LitixDirectory";
export default function CustomOrdersPreview(){
 return <main className="wrap">
  <nav className="nav">
   <a className="brand" href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" alt="Litix — Innovation, Ignited." className="litix-new-logo" /></a>
   <div><a href="/">Home</a><a href="/services">All Litix Services</a><a href="/#checkout">PayKings Checkout</a><a href="/bundles">Growth Bundles</a></div>
  </nav>
  <LitixDirectory standalone/>
 </main>;
}