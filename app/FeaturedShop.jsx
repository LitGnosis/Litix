'use client';
import { useState } from 'react';

export default function FeaturedShop(){
  const [bundle,setBundle]=useState('all');
  const [automation,setAutomation]=useState('all');
  const bundleLinks={all:'/packages',instagram:'/packages?litix_platform=instagram',tiktok:'/packages?litix_platform=tiktok'};
  const autoLinks={all:'/auto-boost',youtube:'/auto-boost?litix_platform=youtube',tiktok:'/auto-boost?litix_platform=tiktok'};
  return <section id="litix-priority-offers" className="lx-priority" aria-labelledby="lx-priority-heading">
    <div className="lx-priority__shine" aria-hidden="true"/>
    <div className="lx-priority__heading">
      <div>
        <span className="lx-priority__eyebrow">✦ LITIX SIGNATURE COLLECTION</span>
        <h2 id="lx-priority-heading">More impact. <em>Less effort.</em></h2>
        <p>Three ways to build your next campaign: ready-made bundles, automated new-post boosts, or fully custom orders.</p>
      </div>
      <span className="lx-priority__headline-badge">✧ FEATURED PICKS</span>
    </div>
    <div className="lx-priority__cards">
      <article className="lx-priority__card" aria-labelledby="lx-bundle-title">
        <div className="lx-priority__card-top"><span className="lx-priority__icon" aria-hidden="true">◇</span><span className="lx-priority__tag">★ FEATURED BUNDLES</span></div>
        <span className="lx-priority__overline">PACKAGES · ONE EASY PURCHASE</span>
        <h3 id="lx-bundle-title">Growth Bundles</h3>
        <p>Choose a platform, then explore ready-made growth packages with their current prices.</p>
        <label htmlFor="lx-featured-bundles">Browse bundle options</label>
        <div className="lx-priority__select-wrap"><select id="lx-featured-bundles" value={bundle} onChange={e=>setBundle(e.target.value)}>
          <option value="all">View all bundles</option><option value="instagram">Instagram Growth Bundles</option><option value="tiktok">TikTok Growth Bundles</option>
        </select><span aria-hidden="true">⌄</span></div>
        <small>Compare available bundles and their exact prices.</small>
        <a className="lx-priority__cta" href={bundleLinks[bundle]}>Explore all bundles <span aria-hidden="true">↗</span></a>
      </article>
      <article className="lx-priority__card lx-priority__card--auto" aria-labelledby="lx-auto-title">
        <div className="lx-priority__card-top"><span className="lx-priority__icon" aria-hidden="true">↻</span><span className="lx-priority__tag lx-priority__tag--auto">⚡ SMART AUTOMATION</span></div>
        <span className="lx-priority__overline">NEW POSTS · AUTOMATED WORKFLOWS</span>
        <h3 id="lx-auto-title">Auto Boost</h3>
        <p>Set rules for future posts with adjustable per-post quantity, pacing and monthly caps.</p>
        <label htmlFor="lx-featured-auto">Choose your Auto Boost platform</label>
        <div className="lx-priority__select-wrap"><select id="lx-featured-auto" value={automation} onChange={e=>setAutomation(e.target.value)}>
          <option value="all">View all Auto Boost options</option><option value="instagram">Instagram Auto Boost</option>
<option value="x">X Auto Boost</option><option value="tiktok">TikTok Auto Boost</option>
        </select><span aria-hidden="true">⌄</span></div>
        <small>Select a platform and configure your automation.</small>
        <a className="lx-priority__cta lx-priority__cta--auto" href={autoLinks[automation]}>Configure Auto Boost <span aria-hidden="true">↗</span></a>
      </article>
      <article className="lx-priority__card lx-priority__card--custom" aria-labelledby="lx-custom-title">
        <div className="lx-priority__card-top"><span className="lx-priority__icon" aria-hidden="true">✧</span><span className="lx-priority__tag">CUSTOM CONFIGURATION</span></div>
        <span className="lx-priority__overline">CHOOSE YOUR SERVICE · SET YOUR QUANTITY</span>
        <h3 id="lx-custom-title">Custom Orders</h3>
        <p>Select an engagement service, a public target, the delivery speed and optional timing in the original Litix order form.</p>
        <small>View your final customer price before checkout.</small>
        <a className="lx-priority__cta" href="/#order">Build a custom order <span aria-hidden="true">↘</span></a>
      </article>
    </div>
    <div className="lx-priority__footer"><span>✓ Review exact pricing before purchase</span><span>✓ Public eligible content required</span><a href="/#order">Or build a custom order →</a></div>
  </section>;
}
