# Litix creator signup & referral attribution — gated release

This feature lives on an isolated branch based on the **production-tracked**
migration/litix-smmxpert-next-20261103 branch. It is not active merely because
a GitHub branch or Vercel preview exists. Leave PayKings, Boostero, AutoLikes,
existing orders, /custom-likes, and /partners unchanged.

## What this actually does

- Adds a free opt-in planner-link email request on the existing home Growth OS section.
- Uses Resend for a single confirmation email (valid 24h), per-email 12-hour
  resend cooldown, and Neon SQL storage with no recurring marketing subscription.
- Confirms one-time creator requests, preserves sanitized Instagram/DM/affiliate
  URL tags, and offers owner-only aggregate counts by campaign.
- Admin creates disabled referral codes, independently approves/activates them,
  and sees raw click counts and confirmed creator leads (not paid orders).
- First-party redirect /r/<code> preserves explicit ref and UTM parameters; no
  pixels, hidden cookies, fingerprinting or user-profile scraping.
- Does not issue affiliate payouts, promise "verified conversions", sign users
  up to newsletters, or use unapproved codes.

## Before staging

1. Verify Neon database **identity** and take a restorable backup. Compare with
   the exact database instance receiving LITIX_GROWTH_DATABASE_URL; do not
   accidentally migrate the wrong historical Neon branch.
2. Apply db/migrations/20261105-creator-signup-affiliate.sql through the
   approved migration process on staging; review role privileges.
3. Keep LITIX_CREATOR_SIGNUP_ENABLED=false until the above passes.
4. Set server-side LITIX_GROWTH_DATABASE_URL (or verify the V2 fallback is
   exactly the migrated database), RESEND_API_KEY, and a domain-validated
   sender orders@litix.net. Do not print keys.
5. Set a unique LITIX_GROWTH_ADMIN_TOKEN of 32+ characters or use an existing
   authorized Guardian owner token, for private reporting and affiliate admin.
6. Put per-IP/ASN/WAF rate limits and bot filtering in front of
   /api/creator-signup. A per-email cooldown alone does not stop distributed
   abuse. Update the published privacy/retention policy for collected email and
   campaign attribution before enabling.
7. Validate the 5 code files and migration review, then run:
   cd src && node --test tests/litixCreatorAttribution20261105.test.mjs
   npm ci && npm run build
8. From an authorized staged origin, test: malformed POST 400, cross-origin 403,
   disabled 503, honeypot, double submission, cooldown, Resend send error,
   24h expiry, successful confirmation, invalid referral code, approval gating,
   owner-only metrics, mobile form and source tags.
9. Check Vercel preview logs and rollback. Test without real payment, supplier
   transactions, public ads or customer order changes.

## After staging only

Enable LITIX_CREATOR_SIGNUP_ENABLED=true in reviewed production env,
deploy reviewed commit to the actual production branch, verify /#growth-studio,
email deliverability, link confirmation and private 30-day metrics.
No automated recurring marketing messages are authorized.

## Private affiliate administration

All requests to /api/affiliates require a server-only Bearer owner token:
- POST {"action":"create","label":"Agency Pilot"} -> disabled code.
- POST {"action":"activate","code":"<approved 24-character hex code>"}
- POST {"action":"deactivate","code":"<code>"}
- GET -> approved/disabled codes, raw clicks, confirmed creator signups.
Never put the Bearer token in browser JavaScript or public issue comments.

Only activated codes resolve via /r/<code>. Payouts and paid sales attribution
require independent written partnership terms, validated settled payment
events and an audited commission ledger; those are NOT implemented here.

## Instagram / ManyChat / Meta Ads prerequisites

Connected Metricool account is @litgnosisllc, not @litixsocial. None of the
Instagram profile links, ManyChat automation, or Meta Story ads can be
activated by shipping this website code alone. Connect @litixsocial as an
Instagram Professional account through legitimate permissions; then configure
the ManyChat Post/Reel comment keyword LAUNCH and test real private replies.
No story ad spend until ad account, approved budget, eligible offer, privacy
requirements, destination review and P0 #167 fulfillment reconciliation.
Do not promote synthetic followers/likes as organic outcomes.

Recommended organic direct links:
- Bio: https://www.litix.net/?utm_source=instagram&utm_medium=bio&utm_campaign=creator_launch#checkout
- Planner DM: https://www.litix.net/?utm_source=instagram&utm_medium=dm&utm_campaign=launch_keyword#growth-studio
- Agency: https://www.litix.net/for-agencies

Checks are release blockers, not marketing "best effort".
