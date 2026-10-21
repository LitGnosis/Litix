# Subscription provider integration — not activated

These new modules adapt the supplied design to the existing Neon database. They do not replace the active checkout, PayKings bridge or supplier fulfillment pipeline. No paid provider submissions were tested. Package status `active` in the proposed dataset is not proof of live catalog readiness.

- Draft mappings supplied by the owner: Auto-SM 1420, SMMGlory 3110, SMMcpan 4910. Standard packages: SMMGlob 4122/5831. These IDs, product semantics and prices still need authenticated provider validation before checkout activation.
- Read server-only AUTOSM_API_KEY, SMMGLORY_API_KEY, SMMCPAN_API_KEY, SMMGLOB_API_KEY. No dummy secrets or fallback webhook secret. An absent key never breaks compilation and never authorizes a submission.
- Configure exact HTTPS AUTOSM_API_URL, SMMGLORY_API_URL, SMMCPAN_API_URL and SMMGLOB_API_URL after checking provider documentation. Website root URLs are not assumed to be API endpoints.
- Bundle-specific orders must be created with delivery_meta.bundlePackageId and, for subscriptions, delivery_meta.customerTargetUsername. Existing orders without that marker cannot be claimed.
- Atomic pending-to-submitting claims block replay/concurrent duplicate submissions. Timeouts, uncertain HTTP errors and malformed acknowledgements require manual synchronization; there is no automatic switch after an uncertain submission.
- Provider acceptance is not delivery completion. The adapter holds accepted orders for provider-specific status synchronization, avoiding the legacy cron's unrelated panel mapping. No claim of automated ongoing delivery is made.
- Recovered the existing deployed NMI receiver: it validates `Webhook-Signature: t=nonce,s=digest` with `NMI_WEBHOOK_SIGNING_KEY`, performs an NMI query and writes verified settled payments to `litix_paykings_outbox`. No new PAYKINGS_WEBHOOK_SECRET is needed. The new internal settlement helper reads that outbox joined to settled checkout rows and matches amount, USD currency, email, order and transaction IDs. It is not a public replacement webhook. The receiver source includes environment-driven hotfixes not contained in this branch; database field compatibility still requires integration verification.
- Before activation, connect bundle checkout to the existing payment flow, add provider-specific read-only catalog/status adapters and enforce globally unique settlement references. Test replay, restart/crash recovery and authenticated end-to-end settlement on a non-production rail. Keep the existing checkout and catalog unchanged until then.
- /success/bundles is a neutral two-second redirect, not a payment or delivery attestation. Browsers may delay timers; exactly two seconds cannot be guaranteed.

The uploaded configuration archive contains no live API keys and is not imported into source control.

## Confirmed public API documentation

- SMMGlory: https://smmglory.com/api/docs — endpoint https://smmglory.com/api/v1. Its documented subscription payload requires delay and does not document a posts limit; exclude it from a guaranteed 30-post offer until semantics are confirmed.
- SMMcpan: https://smmcpan.com/en/api — endpoint https://smmcpan.com/api/v2. Subscription payload supports posts and requires delay. Live service 4910 still needs authenticated validation.
- Auto-SM public homepage says “No subscriptions”; no matching subscription API documentation was found. Do not assume service 1420 or a website root is a validated subscription lane.
