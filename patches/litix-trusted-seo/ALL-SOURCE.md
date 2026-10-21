# Litix Marketing SaaS SEO — complete source (untruncated)

This package is an additive Next.js App Router patch, not an HTML overwrite. It preserves the current storefront, checkout, order routes, and suppliers. It does not force search engine outcomes.

## `seo-metadata.html`

```html
<!-- REFERENCE: In production Next.js app/layout.js metadata generates equivalent tags. -->
<title>Litix | Marketing Automation &amp; Campaign Management</title>
<meta name="description" content="Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and YouTube with Litix.">
<link rel="canonical" href="https://www.litix.net/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Litix">
<meta property="og:title" content="Litix | Marketing Automation &amp; Campaign Management">
<meta property="og:description" content="Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and YouTube with Litix.">
<meta property="og:url" content="https://www.litix.net/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Litix | Marketing Automation &amp; Campaign Management">
<meta name="twitter:description" content="Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and YouTube with Litix.">
<!-- Do not invent a GA4 measurement ID or Search Console verification token. -->
```

## `seo-schema.json`

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.litix.net/#organization",
      "name": "Litix",
      "url": "https://www.litix.net/",
      "description": "Software and digital services for campaign management, order tracking, delivery scheduling, and developer integrations."
    },
    {
      "@type": "WebSite",
      "@id": "https://www.litix.net/#website",
      "name": "Litix",
      "url": "https://www.litix.net/",
      "publisher": {
        "@id": "https://www.litix.net/#organization"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.litix.net/#software",
      "name": "Litix",
      "url": "https://www.litix.net/",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": "Web-based campaign setup, service order management, scheduling and delivery tracking, with developer integration features where enabled.",
      "provider": {
        "@id": "https://www.litix.net/#organization"
      }
    }
  ]
}
```

## `app/robots.js`

```javascript
export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/signin', '/checkout'] }
    ],
    sitemap: 'https://www.litix.net/sitemap.xml',
    host: 'https://www.litix.net'
  };
}
```

## `app/sitemap.js`

```javascript
const BASE = 'https://www.litix.net';
export default function sitemap() {
  const pages = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/platform', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/resources/visibility-acceleration', priority: 0.65, changeFrequency: 'monthly' },
    { path: '/acceptable-use', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/api-docs', priority: 0.6, changeFrequency: 'monthly' }
  ];
  return pages.map(({ path, priority, changeFrequency }) => ({ url: `${BASE}${path}`, priority, changeFrequency }));
}
```

## `app/litix-seo.css`

```css
/* SEO platform additions: scoped classes; original Litix theme and checkout unchanged. */
.litixSeoStrip {margin:28px auto 42px;max-width:1180px;padding:0 20px}
.litixSeoStrip .litixSeoEyebrow{color:#9bdfff;text-transform:uppercase;letter-spacing:.14em;font-size:12px;font-weight:800}
.litixSeoStrip>h2{font-size:clamp(1.6rem,3.8vw,2.5rem);line-height:1.15;margin:8px 0 20px;color:#f3f7fe}
.litixSeoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.litixSeoGrid article,.litixSeoContent{background:linear-gradient(145deg,rgba(37,75,118,.69),rgba(7,19,34,.9));border:1px solid rgba(146,202,242,.42);border-radius:20px;padding:24px;box-shadow:0 18px 36px rgba(0,0,0,.13)}
.litixSeoGrid h3{color:#eff8ff;font-size:1.17rem;line-height:1.35;margin:0 0 12px}
.litixSeoGrid p,.litixSeoContent p,.litixSeoContent li{color:#bed0de;line-height:1.7}
.litixSeoMore{display:flex;flex-wrap:wrap;gap:16px;margin-top:22px}
.litixSeoMore a,.litixSeoContent a{color:#a1dcff;text-decoration:underline;text-underline-offset:3px}
.litixSeoFooter{max-width:1180px;margin:26px auto;padding:20px 24px;border-top:1px solid rgba(145,201,232,.25);color:#bdd0df;font-size:13px;line-height:1.65}
.litixSeoFooter a{color:#b3e1ff;text-decoration:underline}
.litixSeoPage{max-width:980px;margin:60px auto 90px;padding:0 24px;color:#f0f6ff}
.litixSeoPage>h1{font-size:clamp(2.2rem,5vw,3.8rem);line-height:1.12;letter-spacing:-.035em;margin:16px 0 20px}
.litixSeoPage .kicker{color:#81d9ff;letter-spacing:.12em;font-size:12px;text-transform:uppercase;font-weight:800}
.litixSeoPage .litixSeoContent{margin-top:22px}
.litixSeoPage h2{color:#f5f9ff;font-size:1.45rem;margin-top:25px}
.litixSeoPage ul{padding-left:23px}
@media(max-width:780px){.litixSeoGrid{grid-template-columns:1fr}.litixSeoStrip{padding:0 14px}.litixSeoPage{margin-top:32px}}
```

## `app/about/page.js`

```javascript
export const metadata = { title: 'About Litix | Campaign Management Software', description: 'Learn how Litix brings campaign configuration, order tracking, and delivery workflows together in one web platform.', alternates: { canonical: '/about' } };
export default function About() { return <main className="litixSeoPage"><a href="/">← Back to Litix</a><div className="kicker">About Litix</div><h1>Campaign management, with a clearer view of delivery.</h1><div className="litixSeoContent"><p>Litix brings together web-based campaign configuration, delivery scheduling, service-order management, and status tracking for Instagram, TikTok, and YouTube-related campaigns. Customers can select service options and monitor their order progress from one place.</p><h2>What our software does</h2><p>Litix provides order workflows, configurable delivery settings, customer accounts, status notifications, and developer-oriented interfaces where available. Some services may be fulfilled by independent third-party providers rather than by Litix software itself.</p><h2>Our approach</h2><p>Customers should know what is included in a service, its limitations, refund and delivery conditions, and whether any underlying activity is organic, advertising-supported, automated, or supplied by a third party. We do not claim affiliation with the social networks referenced on our site.</p><p>See our <a href="/platform">platform features</a>, <a href="/acceptable-use">Acceptable Use Policy</a>, and <a href="/api-docs">API documentation</a>.</p></div></main>; }
```

## `app/platform/page.js`

```javascript
export const metadata = { title: 'Litix Platform | Automation, Tracking & API', description: 'Explore Litix campaign workflows, delivery controls, tracking tools, and developer interfaces for managing digital marketing service orders.', alternates: { canonical: '/platform' } };
export default function Platform() {return <main className="litixSeoPage"><a href="/">← Back to Litix</a><div className="kicker">Litix Platform</div><h1>One workspace for campaign operations.</h1><div className="litixSeoContent"><h2>Engagement Velocity Syndication</h2><p>Coordinate configured campaign orders and delivery windows in one dashboard. Visibility and engagement outcomes depend on the purchased service and its actual provider; software automation does not itself guarantee reach or platform ranking.</p><h2>Cross-Channel Footprint Optimization</h2><p>Organize campaigns across supported social platforms with consistent order records, performance visibility where data is available, and delivery status reporting.</p><h2>Programmatic Marketing Pipelines</h2><p>Use scheduled actions, status integrations, and available API features to reduce repetitive campaign administration. Actual provider actions are gated by validated payment and fulfillment status.</p><h2>Transparency at checkout</h2><p>Each available product must accurately state what is being supplied, who supplies it when relevant, and any significant service limitations. Litix is an independent platform, not an official service of Instagram, TikTok, or YouTube.</p><p><a href="/">Browse existing packages</a> · <a href="/api-docs">Developer reference</a></p></div></main>}
```

## `app/acceptable-use/page.js`

```javascript
export const metadata = { title: 'Acceptable Use and Service Transparency | Litix', description: 'Litix customer guidelines addressing authorized use, honest service descriptions, campaign limitations, payments, and responsible automation.', alternates: { canonical: '/acceptable-use' } };
export default function Aup(){return <main className="litixSeoPage"><a href="/">← Back to Litix</a><div className="kicker">Policies</div><h1>Acceptable Use and Service Transparency</h1><div className="litixSeoContent"><p>Litix supplies software-supported campaign workflows and may facilitate third-party digital services. Customers must use accounts and profiles they are authorized to manage and comply with applicable law, platform rules, and contractual obligations.</p><h2>Authorized activity</h2><p>Do not use Litix to impersonate others, misrepresent endorsements, distribute spam, conduct harassment, obtain account credentials without permission, manipulate public-sector compliance indicators, or advertise misleading results.</p><h2>Service descriptions</h2><p>Purchased engagement, advertising placement, analytics, campaign-management software, and organic audience development are distinct offerings. The nature and limitations of any selected service must be described truthfully; Litix does not promise that a purchase creates organic interest or platform approval.</p><h2>Third-party integrations</h2><p>Third-party providers and social networks maintain their own terms and policies. Litix does not guarantee acceptance by these platforms and is not their official representative unless explicitly stated with verifiable authorization.</p><h2>Payments and personal information</h2><p>Card data should be captured by authorized payment-provider tokenization fields. Payment status and order status must be verified independently. Customers should receive receipts, tracking information, and clear support and refund information.</p><h2>Compliance Declaration</h2><p>Litix is an independent campaign-management software and digital-services platform. It does not claim official certification, partnership, advertising inventory, or approval from Instagram, TikTok, YouTube, PayKings, NMI, or a supplier without verifiable documentation. Gateway-hosted card tokenization is a security control, not a representation that Litix has independently obtained PCI compliance certification. Product eligibility and fulfillment methods must be presented truthfully and reviewed against applicable rules.</p><h2>Enforcement</h2><p>Litix may decline, pause, investigate, or cancel requests that cannot be fulfilled safely or consistently with these standards, subject to the applicable terms and refund policy. This policy is a draft requiring legal and operational review before being treated as binding.</p></div></main>}
```

## `app/resources/visibility-acceleration/page.js`

```javascript
export const metadata = { title: 'Visibility Acceleration Research | Litix', description: 'A practical guide to campaign delivery, measurement, third-party services, and the difference between authentic reach and purchased engagement.', alternates: { canonical: '/resources/visibility-acceleration' } };
export default function Research(){return <main className="litixSeoPage"><a href="/">← Return to Litix</a><div className="kicker">Litix Research · 2026</div><h1>Understanding Campaign Delivery and Visibility Measurement</h1><div className="litixSeoContent"><p>Digital campaign operations involve several separate systems: audience and creative strategy, content distribution, reporting, payments, and third-party service fulfillment. Treating these steps as distinct makes delivery easier to measure and audit.</p><h2>1. Define the outcome before activating workflows</h2><p>Measures such as reach, impressions, link visits, conversions, and follower counts are different. A purchased follower or interaction is not proof of authentic interest, organic discovery, or a business conversion. Reports should describe each metric accurately.</p><h2>2. Understand service provenance</h2><p>Campaign-management software coordinates instructions and records outcomes. Advertising platforms sell placements under their own rules. Independent engagement-service providers offer different products with varying methods and limitations. Customers should not assume these are equivalent.</p><h2>3. Measure delivery responsibly</h2><p>Use clear order IDs, timestamps, documented status changes, and identifiable measurement sources. Avoid describing opaque third-party metrics as verified conversions. Differences between supplier status and on-platform analytics should be disclosed.</p><h2>4. Design safeguards around automation</h2><p>Keep payment approval separate from bank settlement, verify provider responses, prevent repeated submissions, and send accurate customer receipts. These controls improve operational reliability; they do not by themselves mean a campaign complies with every social network's terms.</p><h2>5. Follow platform and legal requirements</h2><p>Before launching a campaign, confirm the relevant platform's terms, advertising rules, privacy obligations, consent requirements, and the permissions associated with managed accounts. Avoid impersonation, misleading performance claims, or misuse of account credentials.</p><h2>About this resource</h2><p>This is an educational overview of campaign operations and measurement, not an independently peer-reviewed study, a certification, or a guarantee of platform compliance.</p><p><a href="/acceptable-use">Acceptable Use Policy</a> · <a href="/platform">Platform details</a></p></div></main>}
```

## `scripts/apply-seo.cjs`

```javascript
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
  p=replaceOnce(p,'<h1>Metrics That Move.<br/><span>Analytics Amplified.</span></h1>','<h1>Campaign Operations, Connected.<br/><span>Marketing Workflows, Simplified.</span></h1>','hero headline');
  p=replaceOnce(p,'<p><strong>Smart Insights. Real Engagement.</strong> Choose your platform, quality, delivery speed and timing, then track everything from Litix. No social password required.</p>', '<p><strong>Campaign tools in one place.</strong> Configure available engagement-related services, manage delivery timing, and track order status across supported platforms. Service terms and delivery methods vary by product. No social password required.</p>','hero description');
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
```

## `deploy-trusted-litix.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
# Usage from the live Litix repository: bash /path/to/litix-trusted-seo/deploy-trusted-litix.sh
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$PATCH_DIR/scripts/apply-seo.cjs"
npm run build
printf 'SEO patch compiled. Confirm all routes in Vercel preview before production promotion.\n'
# Deploy with your established Vercel/Git workflow after preview review; not automatically here.
```

## `README.md`

```markdown
# Litix search positioning upgrade — additive Next.js patch

This package **does not** replace `public/index.html`, payment forms, product prices, the
Growth Bundles or Auto Boost modules. It targets the existing Next.js App Router repository.

## Metadata
- Title (50 characters): `Litix | Marketing Automation & Campaign Management`
- Description (122 characters): `Manage social campaign orders, scheduled delivery, tracking, and API workflows across Instagram, TikTok, and YouTube with Litix.`
- Canonical host: `https://www.litix.net/`
- Organization, WebSite and SoftwareApplication JSON-LD use only observable features and do not invent endorsements, reviews, certifications, or prices.

## Apply

Copy this package into your trusted developer workspace; from the *Litix git repository root* run:

```bash
bash /path/to/litix-trusted-seo/deploy-trusted-litix.sh
```

The patch reads and checks the actual `app/layout.js` and `app/page.js` anchors. It is
idempotent and **stops without changing pages if its expected anchor is absent**. Review
the git diff and deploy a Vercel preview before changing production. If Vercel's build-step
overlays still create the homepage, apply the patch after those existing overlays and before
`next build` (or commit it to the repository and retire the overlay by explicit review).

## Verify
- Homepage title, description, canonical, Open Graph, Twitter tags, and JSON-LD
- `/robots.txt`, `/sitemap.xml`, `/about`, `/platform`, `/acceptable-use`, `/resources/visibility-acceleration`
- Functional catalog, checkout, orders, and sign-in unchanged
- Rich Results Test and Search Console URL Inspection after release
- Analytics: add a REAL Measurement ID and verified GSC meta token from your account; never placeholders. If these integrations are already installed, don't add duplicates.

**No script can force Google to reclassify or erase search summaries.** Visible service
information must match actual delivery methods. Do not hide genuine product details from
crawlers while showing them to users. This AUP draft needs legal review before final posting.
```

