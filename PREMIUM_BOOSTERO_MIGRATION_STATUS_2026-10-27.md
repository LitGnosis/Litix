# Litix Premium Boostero Migration — Staged Release Report (2026-10-27)

## Scope and release guard

**This PR is a non-billable staging candidate. Do not merge into production or switch fulfillment yet.**
Existing live customer checkout, order tracking, PayKings, Cash App/Bluevine links, existing bundles, Auth0, SMMGLOB historic order records, WhatsApp, Litix AI and active Boostero service mappings remain untouched.

The existing verified production revision is `40f56e3340de942c3953f676817833c1cbf1b211` (deployment `dpl_B6iFJpDPyVmDQU15rMJxm4MgVU8R`).

## Recovery — completed before any implementation

- Exact Git restore branch: `recovery/litix-before-boostero-premium-20261027`.
- Annotated Git tag: `litix-pre-boostero-premium-2026-10-27` (points at exact production revision).
- Sanitized source ZIP in GitHub Actions run `40624587414` / artifact `12788677527` (backup ZIP contains no secrets, user data or Vercel environment values).
- Neon database snapshot was attempted but rejected: **snapshots limit exceeded**. Do not delete snapshots automatically. Existing production data was not altered.
- To roll back: deploy exact production SHA above to `litix_final_logo_corrected_vercel_ready`, confirm homepage/PayKings/Boostero cards, then compare order counts. Do not erase or replay customer orders.

## Read-only live supplier audit

Authenticated Boostero `services` returned:
- 1,783 total supplier services; 1,493 `Default`-type listings, 255 supplier categories.
- 864 safely classifiable *candidate* Default listings after requiring a single recognized platform/kind, finite positive supplier rate, integer min/max, supported single-link behavior and a possible $5 retail minimum.
- 14 platform classifications and 48 display categories among candidates.
- 864 draft mappings inserted into **Neon staging only**: `br-patient-dust-awdnby4p`, `public.litix_boostero_premium_catalog`. All **enabled=false**; zero premium purchase attempts.
- Examples of not-yet-supported types: 121 Package, 92 Custom Comments, 63 Subscriptions, SEO, Mentions variants, Comment Likes and Poll. Exclude these until their exact fields and supported add payloads are validated.
- Supplier marketing terms (speed, non-drop, manual refill) are advertising claims, not independently observed delivery guarantees.

## Staged code delivered

- `/premium-preview`: original Litix midnight-blue/platinum styling; four-step choose platform → category/service → details → review; optional approved live previews for all 14 platforms, sorting first Instagram Followers, Instagram Likes, TikTok Followers, TikTok Likes then others by numeric retail price.
- `/api/premium/catalog`: read-only authenticated live supplier catalog on Preview, 90s cache, 24 items/page, no wholesale fields or API keys in responses. Production fails closed unless `LITIX_PREMIUM_BOOSTERO_LIVE=true`; even then `purchasingEnabled=false` until live purchase path is independently verified.
- `src/lib/boosteroPremiumCatalog.mjs`: customer retail = actual Boostero supplier rate × 1.60, rounded **at final order quantity** to cents; $5 minimum, supported min/max/step, URL host checks, no automatic custom-field guesses.
- `src/lib/boosteroPremiumSync.mjs` and `/api/internal/premium/catalog-sync`: idempotent, bound-JSON bulk refresh, authenticated by `CRON_SECRET`, never activates disabled mappings; no schedule activated yet.
- `public.litix_premium_reviews` staging schema, `/api/premium/reviews`, `/api/internal/premium/reviews`: approved-only public reads, pending-only submissions, HMAC anti-spam, one submission per fingerprint/day, admin bearer moderation, exact paid+completed order proof before Verified Purchase. No fake reviews have been seeded. Optional images accept only explicitly configured trusted host (currently not configured).
- FAQs and real-review submission/empty state added to Preview. Existing production FAQ, AI, logo and storefront unchanged.
- No real payment, supplier add, retry or new order used as a test.

## Release blockers that MUST be resolved before replacing public checkout

1. **Actual 864-service fulfillment:** current production Boostero order handler is hard-coded to approved IG/TikTok follower/like services and existing pricing ladder. It is **not** safe to route the broader candidate services to it. Implement and mock-test each newly supported platform's destination and action requirements, exact live supplier quote, durable claim, PayKings charge, balance, tracking and refunds. Unknown outcomes must remain locked for reconciliation.
2. **Catalog approvals:** 864 imported staging rows are **disabled**. Curate genuinely orderable services; reject anything with custom fields, keyword or multiple links unless explicitly supported. Verify price/quantity and API `add` contract and enable only after safe checkout is ready.
3. **60% accounting:** existing current 4 live service prices remain unchanged until an explicitly validated production cutover. Changing from the old 5×/8× minimum-margin rules to 1.60× must be gated per service with exact total, $5 minimum, payment processing fees and profit validation; reconcile bundles separately without changing their payment links.
4. **One-supplier cutover:** no new SMMGLOB orders may go through the old numeric checkout once Boostero-only production mode is enabled. Add a server-side rejection before payment and preserve all pre-cutover SMMGLOB tracking/fulfillment and historical order data. No production gate switched in this PR.
5. **Special types:** Custom Comments, subscription/AutoLikes, drip-feed, multi-post, Package/SEO/Mentions/Poll and other non-Default service-specific fields need verified form schemas and real supplier-compatible mapping. Do not pretend these are orderable.
6. **Review admin and images:** Preview review moderation bearer is configured privately; no customer reviews published. Production identity/admin flow, image-host/storage policy and a human moderation workflow require final validation before publication.
7. **Recurring refresh / Vercel limits:** a signed internal sync endpoint exists, but no recurring cron was added without confirming project plan cadence limits. Production review/catalog env remains untouched.
8. **Neon snapshot quota:** optional dedicated independent point-in-time snapshot cannot be taken until existing snapshot quota is addressed; release backup strategy should be separately approved.
9. **No reference screenshots were supplied alongside the text directive.** UI was created from the stated premium blue/platinum spec, not copied artwork.

## Test gates

Run `node --test` on all Node tests, `npm run build`, then browser mocks at 320, 390, 768, 1280 px, plus all eight existing mocked PayKings/Bluevine bundle combinations. Require zero failures. Use no live charges or supplier add tests.

**This is substantial implemented staging work, not a claim of a completed production supplier migration.**
