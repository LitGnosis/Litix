# Litix Automatic simplification — implementation handoff

## Deployment status: NOT DEPLOYED
This is an upgrade/preview package, not a full replacement for the production Next.js application. Do not deploy these files as the Litix project root, and do not claim payments/automatic fulfillment have been enabled.

## Verified current production
- Vercel project: litix_final_logo_corrected_vercel_ready
- Deployment: dpl_7YQqbVYDsdxQPVtzbzVaN1vuLbcN (READY at inspection)
- Current Git commit: 06a322dbcfbad8acf51eabf23582f080983f8d3f
- Auto Boost UI source: src/app/auto-boost/AutoBoostClient.js
- Existing creation code: src/lib/autoBoost.js
- Existing services: /api/services, which publishes rateUsd and service minimums.
- Current createAutoBoostCampaign function explicitly allows only YouTube and TikTok. Instagram is displayed in the UI, but is rejected by this backend. Needs genuine Instagram new-post discovery support.

## UX to implement
- Keep platinum/metallic blue visual identity.
- Collect only Account Name and quantities: automatic likes, optional shares, optional reposts, optional saves. Views are read-only and always 3 x likes for *eligible video posts* (not photos). Show delivery on new posts, post-limit details and total checkout price.
- Leofame.com automatic-likes packages observed Oct 19 2026: 50/$4, 100/$7, 150/$10, 250/$15, 500/$24, 1000/$40, 2000/$70.
- They advertise 'includes video views'; 3x ratio is a Litix-specific requirement, not a verified Leofame rate.
- Other platforms (X/TikTok) need their own real pricing and discovery. Do not reuse Instagram Leofame pricing without approval.

## Required production work before enabling customers
1. Obtain complete checked-out production source corresponding to the live deployment, *not an older ZIP*. Current Vercel file-content connector truncates major source files. Do not overwrite the project using partial files.
2. Replace only the existing Auto Boost customer UX. Preserve other pages, existing orders, integrations and branding.
3. Add a server-authoritative price/offer quote endpoint; do not trust browser-submitted cents. Confirm price coverage (post count, term, included video views) before checkout.
4. Verify provider-supported new-post monitoring per selected platform. Instagram is currently blocked in createAutoBoostCampaign(). If Instagram discovery API permissions are missing, report a clear not-ready state; never accept payment first.
5. For each eligible video post and each paid/confirmed campaign, atomically queue exactly one likes order and one views order at 3x likes. Queue optional shares, reposts and saves only when the service and post supports them. Photos must not be promised video views. Use supplier minimum/maximum validation, provider status sync, retry/idempotency, order ledger, and supplier-failure alerts.
6. Guarantee charges match the quoted package and that view fulfillment is budgeted into margin. Do not silently use auto-submit routes that ignore extra fields.
7. Test Instagram, X and TikTok routing (where actually supported), duplicate post detection, checkout success and confirmation emails, insufficient wallet funds, missing service, failed provider, and 3x view order quantity.
8. Deploy through the existing Git-connected Vercel project and verify production independently.

## Included files
- preview.html: standalone interactive customer-facing layout, with no checkout/payment actions.
- src/offer.mjs: tier configuration, bundled views and estimated add-on math.
- tests/offer.test.mjs: Node built-in test runner tests.
- production-source-sha.txt: exact deployment identifier.

## Run tests
node --test tests/offer.test.mjs
