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
