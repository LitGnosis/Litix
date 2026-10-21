# LITIX.NET — DEFAULT SOURCE UPDATE KIT (2026-10-20)

**IMPORTANT: This is an update kit, NOT a standalone website ZIP.** Do not import this ZIP alone as a new Vercel project. `Litix-main 2.zip` contains only a README and cannot be deployed as the Litix storefront.

This ZIP merges the two user-supplied notification fixes into one deduplicated patch. It is specifically designed to be applied to the CURRENT `LitGnosis/Litix` Next.js source, leaving the current website, branded frontend, PayKings/NMI, supplier routing and prices in place. The latest known working Vercel project for `www.litix.net` is `litix_final_logo_corrected_vercel_ready` in team `litgnosisllc-9049`.

## Vercel agent deployment procedure

1. Have the Vercel agent access the current Git-connected **LitGnosis/Litix** source at the production storefront commit, NOT `vercel-agent/nmi-checkout-hardening` (which cannot build the storefront as configured) and not the almost-empty `Litix-main 2.zip`.
2. Unzip this update kit in a separate temporary folder, not on top of the source tree.
3. From the Git source repository root execute:

   `node /absolute/path/to/this-kit/scripts/install.cjs /absolute/path/to/Litix/repository`

   The installer automatically detects when the Next.js project resides in the repository's `src/` directory. It checks the checkout source signature and required files BEFORE writing, and aborts if the current version is not compatible.
4. Inspect `git diff`. Expected modified/added source files only: `app/api/checkout/route.js`, `lib/orderNotifications.js`, `app/api/cron/order-notifications/route.js` and `vercel.json`, relative to the app root. If anything else changes, stop and inspect.
5. Ensure the existing Vercel encrypted environment variables `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, and the tracking token secret already expected by the current app are configured in the target environment. **Never request, print, commit, or package their values.**
6. Run `npm ci`, source tests, and `npm run build` from the app root. Verify existing cron jobs are preserved and the new cron `/api/cron/order-notifications` is present before initiating the build (Vercel registers cron from source metadata before build time).
7. Deploy to a Preview of the **storefront** project first. Verify route `GET /api/cron/order-notifications` rejects unauthenticated access, and verify real email queue writes and safe notification retry behavior against an isolated Neon staging branch. Preview must not charge cards or submit real supplier orders.
8. Only after successful checks and rollback preparation, promote the verified storefront build to production. Do not modify the separate `litix-paykings-webhook` project, swap custom domains, or activate PayKings charges to perform this email update.

## Safety and constraints

- The two notification ZIPs have byte-identical patch components; only one copy is included here.
- The Neon production `litix_order_notifications` table has previously been observed. `patch/schema.sql` is **reference-only**; do not run the migration against production without inspecting existing constraints.
- The `patch/lib/orderNotifications.js` module uses `./db` and `./paymentGateway` from the current Litix code. The installer verifies these files are present and the tracking-token export name exists.
- The existing `https://www.litix.net/track` page is retained.
- The user's currently deployed website may still have an unrelated checkout error: `Invalid gateway response`. This notification update **does not repair NMI payments**. Do not claim otherwise.
- This archive is intentionally not a fabricated full-source backup. Only the repo or a true full-source backup can supply the remaining private source, assets, product catalog, and checkout wiring.

## Contents

- `scripts/install.cjs`: safe installer for current Litix source, with root/src detection and compatibility guards.
- `patch/lib/orderNotifications.js`: email queue + retry sender.
- `patch/app/api/cron/order-notifications/route.js`: authenticated 5-minute cron handler.
- `patch/schema.sql`: reference schema, **not automatically applied**.
- `VERCEL-AGENT-INSTRUCTIONS.txt`: ready-to-send assignment for Vercel's agent.
- `manifest.json`: source hashes and archive provenance.

## Installation status

Packaged and static-syntax tested in ChatGPT. **Not installed in GitHub and not deployed to production.**
