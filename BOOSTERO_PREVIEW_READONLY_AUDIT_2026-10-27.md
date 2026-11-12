# LITIX — Boostero read-only API verification (Preview)

**Date:** 2026-10-27 (UTC)  
**Repository:** LitGnosis/Litix  
**Vercel project:** litix_final_logo_corrected_vercel_ready  
**Branch:** feature/boostero-preview-readonly-20261027  
**Scope:** Preview-only `balance` and `services` POST actions; no checkout, purchases or supplier dispatch.

## Actual Boostero results

- HTTP authentication: succeeded for `action=balance` and `action=services`; zero errors.
- Balance: **USD $0.00**.
- Services returned by provider: **1,783**.
- Matching follower services with valid supplier rates and quantities: **120** (**96 Instagram**, **24 TikTok**).
- Advertised 30-day or longer refill claims: **66 Instagram**, **12 TikTok**.
- Refill classifications reflect listing text. In a standard SMM v2 response, `refill=false` can mean that API refill actions are unsupported even when a service name advertises *manual* refills. A listing is not a delivery/refill guarantee.

## Boostero candidate examples (provider wholesale USD / 1,000)

| Platform | ID | Description | Wholesale / 1k | Min | Max | Advertised refill | Type |
|---|---|---|---:|---:|---:|---|---|
| Instagram | 4366 | USA followers, high quality | $3.78 | 10 | 10,000 | 30 days | Manual advertised, API refill unavailable |
| Instagram | 4533 | Brazil followers, premium | $3.78 | 10 | 20,000 | 30 days | Manual advertised |
| Instagram | 5462 | General premium followers | $5.90 | 10 | 500,000 | 30 days | API refill button indicated |
| Instagram | 5463 | General premium followers | $6.40 | 10 | 500,000 | 60 days | API refill button indicated |
| Instagram | 2132 | USA followers, high quality | $7.245 | 10 | 5,000 | 30 days | Manual advertised |
| TikTok | 5465 | Premium followers | $3.74 | 10 | 15,000 | 30 days | Manual advertised, API refill unavailable |
| TikTok | 5258 | High quality followers | $4.08 | 10 | 100,000 | 30 days | Manual advertised |
| TikTok | 5464 | High quality followers | $4.675 | 10 | 200,000 | 30 days | Manual advertised |

The Boostero rates above are **supplier wholesale prices** from the authenticated API, not consumer retail prices, margin forecasts or approved Litix prices.

## Existing live SMMGLOB-backed Litix catalog (customer retail USD / 1,000)

| Platform | Litix service ID | Listing | Retail / 1k | Supplier min | Max |
|---|---|---|---:|---:|---:|
| Instagram | 33553 | HQ real-account followers, 30-day refill claim | $8.99 | 30 | 100,000 |
| Instagram | 33554 | HQ real-account followers, 60-day refill claim | $10.49 | 30 | 100,000 |
| Instagram | 33555 | HQ real-account followers, 90-day refill claim | $11.99 | 30 | 100,000 |
| TikTok | 33410 | HQ real-profile followers, 30-day refill claim | $11.82 | 50 | 200,000 |
| TikTok | 33395 | Real-profile followers, 365-day refill claim | $18.99 | 10 | 1,000,000 |

**Do not infer margins or savings** by subtracting Boostero wholesale from Litix/SMMGLOB retail: the current SMMGLOB wholesale costs were not retrieved in this test, and quality, targeting, speed, refill handling, fees and platform characteristics can differ.

## Recommended first small supplier test — NOT EXECUTED

**Boostero #5462:** Premium Instagram followers, advertised 30-day refill button; wholesale **$5.90/1,000**, supplier minimum 10, maximum 500,000. An *optional future* quantity-100 order, if approved separately and funded, would have indicative wholesale cost **$0.59 before potential fees**. It is useful for a small manual quality/refill-status test because the listing indicates API refill support rather than only manual refill advertising.

**Blockers before any real test:** The provider balance is $0.00. Obtain explicit approval, verify available funds and provider terms, confirm the intended public test profile and cost, and inspect order status before activating fulfillment. Do not place an order based on this report.

## Safety and release

- Secret read only by a server-side Vercel Preview build; never checked in or returned to browsers.
- The allowlist permits *only* `balance` and `services` for the Boostero hostname. Test suite passed (4 tests).
- Private build script emitted normalized metadata, not API key or raw provider payloads.
- Temporary build-hook change was reverted to the original `npm run build` definition after the audit.
- No persistent backend route or public diagnostic endpoint added.
- No order, refill request, wallet spend, SMMGLOB routing switch, service publication or price update.
- Live storefront/PayKings/Stripe/Bluevine/bundles/Auth0/email/AutoLikes/SMMGLOB unchanged.
- Production deployment not requested and not performed.
