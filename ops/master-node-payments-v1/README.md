# Litix direct-ops payments and owned telemetry — staged integration

**Status:** Source code, not live. No payment endpoints, proxy checks, Redis worker, database migrations, customer charges, or hardware macros were activated by the creation of these files.

The three main files are `app/api/billing/paykings-fulfillment/route.ts`, `scripts/audit-proxy-rings.ts`, and `components/LiveFulfillmentTerminal.tsx`. Supporting files implement authentic gateway signatures, authorized-order matching, durable payment intake, BullMQ wake-up dispatch, an owner-only telemetry API, and Postgres migrations.

This package supports only the `website_preview` and `owned_app_qa` workload kinds from the existing *Litix owned master-node* package (`db/001_master_node.sql`, `master_node_jobs`, `master_fulfillment_grants`, `master_execution_nodes` and its persistent `master-worker.ts`). It does **not** execute synthetic social-media likes, follows, views, fake accounts, or ban/rate-limit evasion. It does not change existing Boostero service routing or old paid orders. Customer financial records and physical network credentials must not be shown to the public.

## 1. Read first: payment provider event semantics

- **NMI/PayKings merchant webhook:** Uses the `Webhook-Signature` header `t=<nonce>,s=<hex>`. Verify `HMAC-SHA256(secret, nonce + '.' + exactRawBody)`. The `t` value is a *nonce*, not a timestamp; replay defense is a unique provider event ID persisted transactionally. The merchant account ID must match the configured value. Merchant webhook docs: https://docs.nmi.com/reference/overview . This is **not** the NMI Merchant Signup (`Signature` header) webhook format.
- **NMI `transaction.auth.success` is not funds capture.** `transaction.sale.success` or `transaction.capture.success` is recorded as *awaiting settlement*. A verified `settlement.batch.complete` containing the matching transaction ID must arrive before a new owned-service job is created. A settlement event that arrives before its sale receipt is stored, then correlated upon receipt. Existing `litix_paykings_outbox` records must not be replayed into this queue. NMI samples: https://docs.nmi.com/reference/transaction-events and https://docs.nmi.com/reference/settlement-events .
- **Stripe:** Checks the `Stripe-Signature` `t=<UNIX seconds>,v1=<hex>` over `timestamp + '.' + exactRawBody` with a five-minute tolerance. Only an exact **payment_intent.succeeded** event with positive `amount_received` may create a newly approved first-party work item. This is captured-payment confirmation, not irreversible bank settlement. Never use `checkout.session.completed` as proof of captured payment.
- All events require a *pre-existing* server-side checkout intent with matching provider, transaction ID, order ID, live mode, currency, positive amount, workload kind, and explicit execution approval. Do not create approval based on arbitrary webhook metadata. The current Litix provider order tables have not been mapped; this is **not** a drop-in replacement for current checkout.
- Other events (refunds, disputes, failures) are logged for operator review without blind job submission. Use the existing finance-support system for customer remedies and risk management.

## 2. Environment and prerequisites

1. Create an isolated staging database branch; apply `db/001_master_node.sql` from the earlier package, then `db/004_payment_and_fleet.sql`. Review table ownership and least-privilege grants with production DBA. Never assume an existing table named `Order` or a Prisma model exists.
2. Copy the new files into the existing Next.js `src/` root preserving their paths; merge `package.additions.json` with actual `src/package.json` **and regenerate a locked dependency tree**. Existing Litix uses Next 15 and does not currently include `pg`, BullMQ, ioredis, Tailwind, or a verified owner access bridge. Complete its CI/build tests before release.
3. Register a merchant webhook in the PayKings/NMI portal only after confirming the correct merchant account, callback events, production signing key and service-category underwriting. Set `NMI_MERCHANT_WEBHOOK_SECRET`, `NMI_MERCHANT_ID`. Only activate `LITIX_PAYMENT_WEBHOOK_ENABLED=true` after the new callback, database and tests are staged. Current Litix webhook handling must stay unchanged; do not double-subscribe or replay payment callbacks.
4. Stripe is **optional**. It must be a separately authorized connected Stripe merchant account, with its own verified `STRIPE_WEBHOOK_SECRET`. Do not infer Stripe availability from a code file. No Stripe account setup or real charge is performed here.
5. Before checkout, the *existing trusted server* must insert `growth_ops.litix_owned_payment_intents` with expected amount/currency/order and the **actual provider transaction ID**. The merchant must have approved the particular first-party product category; only a trusted fulfillment administrator may set `execution_approved=true` after written customer scope and actual delivery capacity are confirmed.
6. Run `tsx worker/payment-outbox-relay.ts` and `tsx worker/queue-assigner.ts` on a **persistent supervised host** connected to Neon and Redis. Keep `LITIX_OWNED_DISPATCH_ENABLED=false` until there is an actual running, owned worker from the preceding master-node package. These workers only enqueue/assign references to genuine first-party jobs and do not run mobile social macros.
7. The owner-only terminal route requires an existing authenticated owner login to mint the signed, one-hour `litix_ops_session` HttpOnly + Secure + SameSite=Strict cookie. Use `signOwnerSessionForTrustedAuth` **only after** server-side verification of the Auth0 owner identity; no browser or public API may mint it. Keep `LITIX_OPS_TERMINAL_ENABLED=false` until wired. Terminals display pseudonymous node IDs, last heartbeat, actual online state and privately measured owned-endpoint latency; a reported carrier is **not** proof of carrier ownership. Do not show this owner terminal publicly.
8. Proxy auditor is **disabled by default**. Once the owned health route `https://www.litix.net/api/fulfillment/health` is verified live, configure approved SOCKS5 endpoints. Secrets should be supplied in secret-managed `LITIX_PROXY_SECRET_MAP_JSON` keyed by proxy ID; never store usernames/passwords in public telemetry. The worker only tests an owned HTTPS health endpoint. Response failures or >300 ms observed HTTPS round-trip mark the path congested; this is **not** a packet-loss measurement and never changes identity to evade a platform's restrictions.
9. All new callback paths need WAF limits, production monitoring and signed-event fixture testing. Maintain existing compensation/reconciliation controls and incident #167. No automatic payment reversal or duplicate supplier submission.

## Deployment checklist

- [ ] Confirm live NMI gateway and supported merchant-category underwriting; verify the signing key format and events from an actual provider-supplied test fixture.
- [ ] Confirm, if applicable, an active Stripe account and event destination secret. Do not enable Stripe solely for this project.
- [ ] Confirm New owned-service checkout intent writer, merchant scope approval, explicit execution approval and dual-gateway financial dedupe.
- [ ] Validate all migrations on a staging Neon branch and a restoration test; never store raw card details.
- [ ] Unit tests, dependency-lock install, TypeScript strict compilation, Next build, and staging webhook replay tests pass.
- [ ] Verify Redis persistent worker, node heartbeat and queue recovery under failed Redis/Neon/worker conditions; no jobs for unverified side effects.
- [ ] Verify owned SOCKS5 routes and health endpoint; do not scan third-party sites or bypass platform limits.
- [ ] Wire real Auth0 owner access and securely minted session cookie; do not release owner telemetry to anonymous visitors.
- [ ] Confirm production gateway callback registration and DNS/TLS, trace a no-charge sandbox payment event, then limited merchant-authorized real payment with explicit separate approval.
- [ ] Confirm customer receipt, order status, refund/dispute handling, and rollback, preserving current Litix PayKings/Boostero paths.

## Validation executed in source environment

`node --experimental-strip-types --test tests/*.test.mjs` tests cryptographic signatures, signed owner sessions, and event gating. Full dependency installation, end-to-end gateway verification, CI and live fulfillment are separate required gates.
