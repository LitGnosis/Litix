# Litix Instagram + TikTok visual post picker (isolated prototype)

This branch introduces an **opt-in, no-charge preview**, not a live checkout. The existing payment, catalog, Boostero integration, Bluevine bundles, tracking, Auth0, AI, and Resend code is untouched.

## User experience

1. Visit /post-picker-preview.
2. Select Instagram or TikTok.
3. Enter a public @username or public profile URL.
4. Tap the thumbnails in the three-column gallery; select up to eight posts (including three).
5. Enter the total likes. A pure function divides the total across posts, preserving exact integer totals.
6. Review each selected post and its canonical URL and allocated quantity.

No customer copies post URLs, submits a payment, or triggers a supplier order.

## Public media technology

- Server-side API: GET /api/post-picker?platform=instagram&username=HANDLE
- Instagram actor: coregent/instagram-posts-scraper, using profiles:[handle], resultsLimit:24.
- TikTok actor: vtrdev/tiktok-scraper, using startUrls:["https://www.tiktok.com/@"+handle], limit:24.
- Both are third-party Apify public-content collectors, **not official Instagram/TikTok APIs**. Vendor reliability, pricing, rights, platform terms, and production performance must be evaluated before enabling.
- Official TikTok Display API instead requires creator authorization for video.list; official Instagram APIs have account-type/permission restrictions, so neither universally supports anonymous public-profile browsing.
- Supplier names and API secrets are never included in browser JSON. No media is re-hosted; signed thumbnails may expire or fail to load.

## Configuration (server-side only, never NEXT_PUBLIC)

- APIFY_TOKEN: An Apify token with access to the chosen Actors.
- LITIX_POST_PICKER_ENABLED=true: Enables the read-only post gallery API (default: disabled).

Before enabling on a publicly accessible site, add durable ingress rate limits/WAF/budget caps: the included per-instance throttle and 10-minute cache mitigate repeats but **are not** distributed rate limiting on Vercel. Validate actor output and billing under production traffic.

## Release gates still required

- Connect verified eligible Boostero Instagram/TikTok Likes service types only. Never SMMGLOB or SMMFOLLOWOM for new orders.
- Determine service-specific post eligibility (including TikTok photos vs video), per-post min/max/step, 60% wholesale markup and the current $1 checkout floor server-side, independently of the visual preview.
- One payment = one parent order with N child allocations, each using its own canonical post URL and supplier quantity. Persist all allocations before fulfillment.
- Verify one successful PayKings/NMI settlement before exactly-once dispatch of each child via Boostero; keep separate supplier IDs, per-post tracking, customer receipts, owner notifications, and manual review for ambiguous outcomes. Avoid blind retry or duplicate charges.
- Resolve TikTok short/share links server-side with strict allowed-host/redirect validation if adding a manual fallback; the picker does not need the user to paste individual TikTok links.
- Keep the existing live checkout operational. Do not merge/deploy this preview as a paid multi-post offer until the complete charge/child-order pipeline is tested with mocks and safe authorized validation.
- Confirm whether production deploys from the same GitHub branch. The current main /api/checkout returns HTTP 503 by design, so repository presence does not demonstrate a working production checkout.

## Validation

Run:
node --test src/tests/post-picker.test.mjs
npm run build

All provider tests must use mocked responses or test accounts and avoid real PayKings charges and supplier orders.
