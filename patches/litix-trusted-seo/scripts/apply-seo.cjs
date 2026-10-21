'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
function source(rel){return path.join(root,rel)}
function ensureFile(rel){const p=source(rel);if(!fs.existsSync(p))throw Error('Expected existing Litix file missing: '+rel);return p}
function replaceOnce(s,needle,replacement,label){const count=s.split(needle).length-1;if(count!==1)throw Error(label+' expected one match; got '+count);return s.replace(needle,replacement)}
function copy(from, to){const a=path.join(__dirname,'..',from),b=source(to);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b)}
const layout=ensureFile('app/layout.js'),page=ensureFile('app/page.js');
const marker='/* LITIX_SEO_PATCH_V1 */';
let l=fs.readFileSync(layout,'utf8');
if(!l.includes(marker)){
  l=replaceOnce(l,"import './globals.css';","import './globals.css';import './litix-seo.css';",'layout CSS');
  l=l.replace(/export const metadata\s*=\s*\{[\s\S]*?\};/, `export const metadata = {
    metadataBase: new URL('https://www.litix.net'),
    title: 'Litix | Marketing Automation & Campaign Management',
    description: 'Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and YouTube with Litix.',
    alternates: { canonical: '/' },
    openGraph: { type: 'website', siteName: 'Litix', title: 'Litix | Marketing Automation & Campaign Management', description: 'Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and YouTube with Litix.', url: 'https://www.litix.net/' },
    twitter: { card: 'summary_large_image', title: 'Litix | Marketing Automation & Campaign Management', description: 'Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and YouTube with Litix.' }
  };`);
  if(!l.includes('metadataBase:'))throw Error('Metadata injection not applied');
  const graph=JSON.parse(fs.readFileSync(path.join(__dirname,'..','seo-schema.json'),'utf8'));
  const schema=JSON.stringify(graph).replace(/</g,'\\u003c');
  l=replaceOnce(l,'<body>',`<body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:${JSON.stringify(schema)}}} />`,'layout body');
  l=marker+'\n'+l;
  // Defer writing until every homepage anchor has been checked.
}
let p=fs.readFileSync(page,'utf8');
if(!p.includes('LITIX_SEO_HOME_V1')){
  // Preserve the existing branded hero: Metrics That Move / Analytics Amplified.
  // Preserve the existing hero description and merchandising.
  const features=`{/* LITIX_SEO_HOME_V1 */}<section className="litixSeoStrip" aria-label="Litix marketing operations software"><div className="litixSeoEyebrow">Litix Campaign Management Platform</div><h2>Automated workflows. Clear campaign tracking.</h2><div className="litixSeoGrid"><article><h3>Engagement Velocity Syndication</h3><p>Coordinate campaign delivery settings and track service orders with clear fulfillment status. Results depend on the selected provider and service.</p></article><article><h3>Cross-Channel Footprint Optimization</h3><p>Manage campaign activity across Instagram, TikTok, and YouTube from one dashboard and review available delivery metrics.</p></article><article><h3>Programmatic Marketing Pipelines</h3><p>Use scheduled campaigns, order notifications, and supported developer integrations to reduce repetitive administration.</p></article></div><div className="litixSeoMore"><a href="/platform">Explore platform capabilities</a><a href="/about">About Litix</a><a href="/resources/visibility-acceleration">Research and measurement</a></div></section>`;
  p=replaceOnce(p,'<FeaturedShop/>','<FeaturedShop/>'+features,'feature positioning');
  const foot=`<aside className="litixSeoFooter" aria-label="Service transparency">Compliance Declaration: Litix provides software-supported campaign management and clearly identified digital services. Our payment workflow uses third-party gateway tokenization; this does not constitute independent PCI certification. Some campaigns use external suppliers. Purchased engagement is distinct from advertising placement or organic audience growth, and may be restricted by third-party platforms. <a href="/acceptable-use">Acceptable Use &amp; Service Transparency</a> · <a href="/about">About</a></aside>`;
  p=replaceOnce(p,'</main>',foot+'</main>','homepage footer');
  // Defer writing until all source transformations succeed.
}
// Both source files passed single-anchor checks.
fs.writeFileSync(layout,l);
fs.writeFileSync(page,p);
for(const f of ['app/litix-seo.css','app/robots.js','app/sitemap.js','app/about/page.js','app/platform/page.js','app/resources/visibility-acceleration/page.js','app/acceptable-use/page.js'])copy(f,f);
console.log('LITIX_SEO_V1_READY: preserving original storefront, catalog, checkout and supplier routing');
