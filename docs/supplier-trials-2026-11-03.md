# Litix — Alternative Supplier Qualification (SMMXPERT + MoreThanPanel)
Created November 3, 2026. **Evaluation only; production Boostero remains exclusive for new orders.**

## Vendor qualification

| Vendor | API v2 endpoint | Trial path | Official source |
| --- | --- | --- | --- |
| SMMXPERT | `https://smmxpert.com/api/v2` | Register, request a free trial from vendor support; user guide directs requests to WhatsApp/Telegram. Email: `support@smmxpert.com` | https://smmxpert.com/api , https://smmxpert.com/user-guide |
| MoreThanPanel | `https://morethanpanel.com/api/v2` | Register and request verified reseller **free test balance**; proof can be active domain `litix.net`. Email: `hello@morethanpanel.com` | https://morethanpanel.com/api , https://morethanpanel.com/refund-policy |

**Current status:** MoreThanPanel inquiry email sent via Litix's connected Gmail. SMMXPERT outreach email was blocked by sending safeguards, not confirmed sent. Account approval and trial keys are pending; no orders have been placed or funds deposited.

## Safe read-only trial preparation

1. Both API docs support SMM Panel v2 actions `services`, `balance`, and `status`, sent as `POST` to the supplier's fixed HTTPS endpoint.
2. The dormant `src/lib/supplierTrialReadOnly.mjs` module can only run those three actions. It **does not include `add`, `refill`, `cancel`, or payment operations**. Historical Boostero IDs are never valid as trial-owned status IDs.
3. Obtain a vendor account/API key by the vendor's official signup process. **Do not send API keys by email or paste them into chat or source control**. Store securely in a separate, limited trial environment.
4. For an optional operator-controlled read-only audit, set `LITIX_TRIAL_SMMXPERT_API_KEY` and/or `LITIX_TRIAL_MORETHANPANEL_API_KEY` as process environment variables in that isolated environment and run `node scripts/litix-supplier-trial-readonly.mjs`.
5. Output includes valid catalog count, platform counts, currency, and latency. **Neither the full wholesale price list nor key/balance gets logged.** A currency other than USD must not be treated as USD or compared before proper conversion.
6. Tests run with `node --test src/tests/supplier-trial-readonly-20261103.test.mjs`; CI uses mocks only and never reaches vendors.

## Evaluation decision gates

- **Identity and legal:** verify company contact, business details, terms, acceptable-use, payment/refund restrictions and support availability. Positive reviews alone do not validate fulfillment quality.
- **Catalog:** prove service IDs, exact field requirements, U.S./global targeting, limits, valid link formats, currency, pricing, cancellations and claimed refill eligibility with the vendor account.
- **Reliability:** repeat read-only catalog and balance checks at intervals; measure latency, timeout/error rate and price drift. Status checks only for trial orders belonging to that provider.
- **Small trial:** only after explicit separate authorization and funded trial credit, place minimal orders on targets the owner controls. Log start time, completion time, delivered amount, partial/cancel outcomes and supplier response time. Never resubmit an ambiguous order.
- **Order architecture:** keep idempotency keys, one confirmed payment per order, separate supplier-ID namespace, tamper-resistant server-side pricing and customer tracking for every child order.
- **Activation:** no automatic production routing or supplier swap until trial delivery/refund outcomes are reviewed, production secrets are stored safely, and a staged rollout/rollback has been explicitly authorized.
- **Platform compliance:** purchased/artificial social engagement can violate Instagram/TikTok rules. Verify legal and acceptable-use implications, and do not promise non-drop/organic delivery.

## Existing Litix constraints

- Preserve PayKings/NMI, Bluevine bundle routing, Auth0, Resend, prices and existing paid order records.
- Leave existing Boostero supplier order IDs and five canceled multi-post child orders untouched.
- No SMMGLOB/SMMFOLLOWOM restoration. No duplicate payments or supplier purchases.
- No changes to the active public service catalog or checkout until the new supplier integration has completed all gates.

## Trial scorecard (to fill with observed evidence, not marketing promises)

| Metric | SMMXPERT | MoreThanPanel |
| --- | --- | --- |
| Verified reseller account/API credentials | Pending | Pending |
| API `services` and `balance` successful | Not run | Not run |
| USD wholesale rates for desired services | Unknown | Unknown |
| Average live read-only API response time | Not measured | Not measured |
| Test credit granted | Not confirmed | Requested |
| Eligible Instagram/TikTok U.S. services verified | No | No |
| Minimum test order completed | Not authorized | Not authorized |
| Partial/refund test verified | No | No |
| Priority support response time | Not measured | Not measured |
| Ready for Litix customer traffic | **No** | **No** |
