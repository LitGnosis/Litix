# Litix — Permanent order confirmation and tracking email fix

Prepared on 2026-10-19. **Source-level patch for the current GitHub `LitGnosis/Litix` Next.js source; NOT YET committed to GitHub.** Do not deploy this ZIP on its own or replace the main website with it.

## Why this patch is necessary
The Litix checkout confirmation email route has been deployed as a Vercel build-time overlay, but Vercel registers scheduled Cron Jobs from `vercel.json` **before** the build runs. Adding a Cron Job during the build therefore does not register the scheduler. This patch modifies the CURRENT repository's `vercel.json` before deployment and preserves its existing reconciliation, auto-boost, campaign and catalog jobs.

## Changes
- Automatically queue and attempt an order-received email when a valid checkout is created. The email explicitly distinguishes 'order recorded' from 'payment verified' and never authorizes fulfillment.
- Send payment verified, supplier-submitted, delivery-completed and review notifications based on the real database order status, with resilient retry and idempotency keys.
- Include the order reference and a link to the **existing** `https://www.litix.net/track` page, where the customer uses their order email to see status. The existing track page is NOT replaced.
- Add one 5-minute Cron Job for `/api/cron/order-notifications`; retain every existing Cron Job.
- Never alter PayKings, NMI keys, supplier routing, margins, presets, or the premium frontend.

## Deployment to current Git source
1. Check out the CURRENT commit of the `LitGnosis/Litix` repository (do not use old master ZIPs).
2. Unzip the `Litix-Source-Notification-Fix-2026-10-19` directory outside the repo. In the repo root run `node /path/to/Litix-Source-Notification-Fix-2026-10-19/scripts/apply-to-current-site.cjs`.
3. Inspect `git diff`: only `app/api/checkout/route.js`, `lib/orderNotifications.js`, `app/api/cron/order-notifications/route.js` and `vercel.json` should change. Existing `/track` code stays untouched.
4. Run the production Next.js build on a preview and verify unauthenticated cron requests are rejected. Then commit and deploy via the connected Vercel Git integration.
5. Ensure `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, and one stable HMAC secret used by the existing application are installed securely in Vercel. Do not put credentials into the repository or emails.
6. Neon production table `public.litix_order_notifications` has already been created; do NOT run a schema migration on a different database without checking. The included `schema.sql` is for review.
7. After deployment, verify email queue rows move from `pending` to `sent` and that `/track` recognizes the order ID plus customer email. Do not test by charging a second time unnecessarily.

**Current state:** PayKings redirect and initial email generation were deployed with Vercel overlays; the separate recurring email Cron Job is NOT confirmed live because its previous build-time-only schedule did not register. This ZIP is the remaining durable Git-source fix.
