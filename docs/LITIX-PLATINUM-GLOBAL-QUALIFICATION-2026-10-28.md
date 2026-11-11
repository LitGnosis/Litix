# Litix Platinum Global — verified engineering baseline and supplier qualification
_Date: 2026-10-28. Evidence from connected GitHub, Vercel, Neon and suppliers' public documentation._

## Production / recovery checkpoint
- Known-working source: `a4d1d152fda00444242174bc4b668c08a18648f8`
- Immutable Git tag: `litix-working-2026-10-28-a4d1d152`
- Protected Vercel production: `dpl_68nf7SLM7QBztTTPVzHrqrsV7qhY`
- Production aliases: `litix.net`, `www.litix.net`
- Private source backup (independent private repository): `LitGnosis/e-commerce-production-hardening`, path `private-backups/litix-2026-10-28`.
- Parent PRs #83, #84 and #85 are unmerged drafts. This project is stacked on PR #85, not on main.
- Never auto-promote a preview over the working live deployment. The current live new-order supplier is **Boostero only**.

## Existing product and infrastructure verification
| Capability | Observed evidence | Classification |
|---|---|---|
| Boostero production orders | Actual owner-reported paid payment / supplier ID / delivery and four approved rows in `litix_boostero_services` | Operational for the four approved services |
| Supplier routing matrix | `litix_async_supplier_routes` exists, has **0 rows** | Schema only, not a live router |
| Agency API keys | `litix_api_keys` has **1 active hashed-key row**; no external API contract checked | Partially implemented; never expose key hashes |
| Supplier price matrix | `litix_supplier_price_matrix` exists, **0 rows** | Not operational |
| Supplier orders | `litix_supplier_orders`: 28 records (23 pending payment; remaining in mixed paid states) | Historical/order ledger present; do not assume open payments need supplier dispatch |
| Workspace/campaign schemas | `litix_campaigns` **0 rows**; several auxiliary workspace and recurring structures exist in migration definitions | Partially implemented / customer flows not verified |
| Live Auth0, PayKings, Bluevine, Resend | Existing integrations and owner-confirmed paid order email/fulfillment paths | Preserve; new feature-level E2E not verified |
| Guardian, Litix AI | Existing routes and source tests | Test coverage exists; always-on operational effectiveness not independently demonstrated |
| Neon global Boostero inventory | Staging additive tables exist; previous read query returned **0** inventory records | Import NOT completed; do not publicly sell additional entries |
| Cloudflare R2 | Existing workflow, latest probe `InvalidArgument` PutObject failure | Not verified; backup restoration not verified |
| CI | Dedicated Boostero safety/fulfillment checks passed on PR #85 branch | Guardrails verified; does NOT prove global rollout works |
| Staging custom order forms | Username, post/multi-post, comments, subscription/drip-feed forms in preview | Draft validation only; no payment or dispatch support for unapproved services |

**Architecture correction:** current root `src/package.json` declares Next.js 15, React 19, and Neon serverless; the source should not be described as a complete TypeScript/Tailwind/Prisma stack without checking actual usage. Source is mainly JSX / ESM.

## Global provider research — not account verification
1. **Boostero — current best fit, no switch.** Only upstream with verified account access, actual fulfillment and four live approved services. All other candidates stay disabled for new orders.
2. **MoreThanPanel — strongest documented secondary API**: `https://morethanpanel.com/api`. Published services, balance, rate/min/max, status batching (up to 100), cancellation/refill. No webhooks; statuses require bounded polling. Not financially or commercially verified for this user; NO live routing.
3. **JustAnotherPanel.live — evaluation only**: `https://www.justanotherpanel.live/api` documents JSON POST `/api/public/v2`. Other domains using the JustAnotherPanel name are NOT proven the same business. Independently verify legal entity and account domain before adding a key. No live routing.
4. **SMMWiz — evaluation only**: `https://smmwiz.com/blog` describes `https://smmwiz.com/api/v2` but we have no authenticated catalog, measured success rates, or account terms. No live routing.

Supplier qualification requires legal/domain proof, reseller authorization, account ownership, supported platform policies, account-specific catalog and costs, input types, status/refill/cancel behavior, observed latency and availability, documented terms and support, and explicit owner approval. A published API **does not** satisfy these gates. Never describe paid engagement as organic, domestic or risk-free without evidence.

All API qualification calls must be read-only, from a restricted preview environment, with exact HTTPS host allowlists. Existing `boosteroProduction` and checkout handlers remain authoritative; alternative adapters do not call supplier `add`/refund/refill and cannot change checkout routing.

## Competitive research / measurable product differentiators
- **Leofame**: customer-friendly no-password checkout, service-level clarity and refill terms: https://leofame.com/faq . Litix should retain no-password checkout and avoid customer-facing supplier jargon.
- **Countik**: free public TikTok profile analytics and exports: https://countik.com/tiktok-analytics . Litix needs authorized/legitimate analytics with clear measurement sources, not inferred follower attribution.
- **SocialBoosting**: broad platform sales with service tiers and support: https://www.socialboosting.com/about-us . Differentiate on trustworthy status reporting, predictable pricing and support—not unsubstantiated guarantees.
- **Teaserid**: long-running multi-platform offering according to its own about page: https://teaserid.com/page/about-us . Do not assume supplier access or enterprise features.
- **Target metrics (NOT measured or achieved):** p95 catalog read < 500 ms where cached, high mobile Core Web Vitals pass rates, zero duplicate charged idempotency keys, >99.9% independently monitored uptime, 100% correct status reconciliation and full recovery drill. Measure these before claiming top-tier percentile.

## Safely staged in this branch
- `platinumSupplierQualification.mjs`: explicit live supplier lock, provider identity and evidence gates, account catalog validation, measured sample summary.
- `platinumReadOnlySupplierAdapters.mjs`: fixed-host preview-only catalog/balance probes. MoreThanPanel status batch plan with <=100 owned IDs, no webhooks assumed.
- `/api/internal/platinum/qualification`: preview-only, sanitized qualification scores; 404 in production.
- `/platinum-global-preview`: premium blue-metallic review UI, preview-only, no sales calls.
- No customer-facing pricing, checkout or design changed. No migrations, live supplier actions, payment captures or PII processing.

## Release blockers
1. Verify isolated Neon global inventory import row counts against actual Boostero API; account and provider retail pricing approvals for each additional service.
2. Implement production-grade forms, server-side order validation, idempotent dispatch and tracking only for approved service types.
3. Verify payment tokenization on iOS Safari, browser responsiveness, real order tracking and customer emails through a non-chargeable gateway setup.
4. Complete authenticated, isolated Cloudflare R2 encrypted backup + restore; preserve existing eight secrets.
5. Measure SLA, accessibility, latency and queue failure recovery before claiming world-class performance.
6. Commercial/identity checks for all candidate vendors; none is permitted to displace Boostero.
