# LITIX Owner Wholesale — PR #53: Auth0 verification and launch gates

Status: **DRAFT — Preview only, no purchases and no production merge** (October 27, 2026).

## Completed in feature branch
- Dedicated Auth0 **Regular Web Application** Authorization Code + PKCE; CSRF state/nonce, exact pinned issuer, client ID/audience, expiration, RS256 Auth0 JWKS signature, **exact owner \`sub\`** validation. Server-signed one-hour Secure, HttpOnly, SameSite=Lax, \`__Host-\` cookies.
- Every human owner API operation requires a valid owner session and exact same-origin check. Machine cron additionally requires \`CRON_SECRET\`. No email-based role assumption, URL toggle or public wholesale API. Unauthenticated requests return 401.
- Read-only live supplier catalog for SMMGLOB and Boostero using private server credentials. Instagram Followers only; IDs, wholesale per 1K, min/max, supplier speed claims, refill duration and *API refill* versus *advertised/manual refill*. Availability is returned per-provider without inventing services.
- **New** private wallet balances per provider (unavailable if provider API cannot respond). The UI distinguishes catalog access from balance access.
- Server-side current quote and destination validation, owner-confirmed supplier-wallet purchases, isolated PayKings flow.
- PayKings **approval is not settlement**: approval persists the gateway transaction ID and pending status, then stops. Owner-only and cron settlement checks require exact order ID, numeric transaction ID, USD amount, successful sale action AND successful settle action with complete condition; only after that can the atomic once-only supplier claim dispatch.
- Owner PayKings gross-up fee calculator covers percentage applied to the **total collected**, plus verified fixed fee. No guessed merchant fees.
- Durable supplier attempt ledger, \`(owner_sub,idempotency_key)\` unique constraint, partial unique \`(owner_sub,fingerprint)\` index for active orders even with different keys, no automatic retry of unknown supplier outcome.
- Owner tracking with provider order ID, supplier-reported completed/remains, owner-supplied original followers (not independently verified), saved refill terms, Resend order/failed/delayed notices.
- Zero modifications to public catalog sort, customer checkout, retail pricing, storefront, bundles, WhatsApp, Litix AI, AutoLikes, Auth0 customer login, or existing SMMGLOB/Boostero routes.

## Already configured (do not repeat)
- \`AUTH0_DOMAIN\`: exists in Vercel Production.
- \`AUTH0_SECRET\`: exists in Vercel Production and Preview.
- \`BOOSTERO_API_KEY\`: exists in Vercel Production/Preview; previous read-only Boostero API authentication succeeded.
- \`RESEND_API_KEY\`: exists in Vercel.
- New owner ledger migration applied on Neon staging \`br-patient-dust-awdnby4p\`. Active-order unique index verified; **zero owner orders / supplier attempts**.
- \`LITIX_OWNER_ALLOWED_ORIGIN\` configured for THIS feature branch Preview, pinned to
  \`https://litixfinallogocorrectedvercelready-git-dd0122-litgnosisllc-9049.vercel.app\`.
- `LITIX_OWNER_DATABASE_URL`: configured as **Sensitive Preview environment variable scoped to PR #53** and connected to Neon staging `br-patient-dust-awdnby4p`; production database untouched.
- Owner purchases, PayKings owner checkout and settlement verification are NOT enabled.

## Exact remaining Auth0 owner administrator action

**No Auth0 management connector or token granting account/user administration is available. No owner identity has been guessed.** The existing environment settings do not include the exact \`LITIX_OWNER_AUTH0_SUB\`; the Production \`AUTH0_CLIENT_ID\` / \`AUTH0_CLIENT_SECRET\` pair is incomplete, and the owner's feature branch has no authorized complete Client ID + Client Secret pair.

1. In your **existing Auth0 tenant**, open **Auth0 Dashboard → Applications → Applications**.
2. Choose the existing **Regular Web Application** that you trust for Litix, or create a **separate Regular Web Application** called *Litix Owner Wholesale*. A separate application in the same tenant is preferred to avoid changing customer-login behavior. Do not use a public SPA client secret.
3. Under **Settings → Application URIs**, add the **exact** Preview callback:
   \`https://litixfinallogocorrectedvercelready-git-dd0122-litgnosisllc-9049.vercel.app/owner/wholesale/callback\`.
   Prepare the Production callback for the future approved release: \`https://litix.net/owner/wholesale/callback\`.
   Add the corresponding origins to **Allowed Web Origins** and \`https://litix.net/\` / Preview origin to **Allowed Logout URLs**. Auth0 callback matching is exact; save changes.
4. Open **Auth0 Dashboard → User Management → Users → your OWN verified admin account**. Copy its **\`user_id\`** (OIDC \`sub\`), e.g. \`auth0|...\` or \`google-oauth2|...\`. The application checks the full exact stable \`sub\`, **not email**. Confirm this account is the intended owner and not an ordinary customer.
5. In **Vercel → litix_final_logo_corrected_vercel_ready → Settings → Environment Variables**, add as **Preview, scoped only to \`feature/private-owner-wholesale-20261027\`**:
   - \`AUTH0_CLIENT_ID\` — Client ID of the selected owner Regular Web Application.
   - \`AUTH0_CLIENT_SECRET\` — its Client Secret, **Sensitive**, never in GitHub/chat/browser.
   - \`LITIX_OWNER_AUTH0_SUB\` — exact trusted owner user ID.
   - Retain the existing \`AUTH0_DOMAIN\`, \`AUTH0_SECRET\` and branch-scoped \`LITIX_OWNER_ALLOWED_ORIGIN\`.
   After owner login works and customer access is denied, prepare equivalent values for Production only with a separate approved release.
6. Trigger/redeploy PR #53 Preview to load new secrets. Sign in through \`/owner/wholesale/login\`; verify the trusted owner sees the dashboard, and a different customer account gets **403 after Auth0 login** or **401 without an authorized session**. Avoid uploading or sharing credentials in ChatGPT.

## Supplier verification blockers

- **SMMGLOB**: \`SMMGLOB_API_KEY\` was **not found** in the scoped Vercel environment inventory. Add it securely as Sensitive after checking the known SMMGLOB account. Without it, SMMGLOB wholesale list and balance will honestly be **Unavailable**; customer integration is unchanged.
- **Boostero**: API credentials exist, and prior read-only verification succeeded. End-to-end owner dashboard catalog is **unverified** until owner login is configured. The API runs live server-side on authenticated requests only; no static/fabricated wholesale rates.
- Both suppliers' speed, low-drop and refill terms are *listing claims*, not proven fulfillment rates.

## Owner PayKings: separate blocked release gate

The existing **public** PayKings checkout was NOT changed. The owner option intentionally stays disabled without:
- Actual merchant processing fees (in basis points and fixed cents), configured in \`LITIX_OWNER_PAYKINGS_FEE_BPS\` and \`LITIX_OWNER_PAYKINGS_FEE_FIXED_CENTS\` only from real PayKings terms.
- Confirmed matching production Collect.js key; \`NMI_SECURITY_KEY\` is already used in public production and is not copied into source.
- Verified access to NMI Classic read-only transaction Query API and exact matching **settled** responses for owner transactions. After verification, \`LITIX_OWNER_PAYKINGS_SETTLEMENT_VERIFIED=true\` must be explicitly approved.
- A signed webhook scheme was **not established**. **Do not claim webhook authentication**. The dedicated owner path deliberately ignores unsigned callbacks; it can reconcile with authenticated, read-only NMI Query API instead when independently verified.
- \`LITIX_OWNER_PAYKINGS_ENABLED=true\` must not be set before all preceding checks.
- \`LITIX_OWNER_WHOLESALE_PURCHASES=true\` must not be set before owner identity verification, production database migration and separate final approval.

## Release and rollback

- Production untouched by this PR. Keep PR #53 **DRAFT**, do not merge or promote.
- Before release, take an **independent** Neon backup/snapshot if quotas permit, or explicitly approve a documented equivalent restore strategy; add the new owner-only tables in a transaction after verifying existing order counts. Never erase existing SMMGLOB/customer orders.
- Deactivation: set \`LITIX_OWNER_WHOLESALE_PURCHASES=false\` and \`LITIX_OWNER_PAYKINGS_ENABLED=false\`, redeploy. Keep the ledger permanently for financial audit and ambiguity resolution; never blindly reverse recorded sales.
- Supplier timeouts and uncertain gateway outcomes never trigger automatic retries.
- Last no-charge CI: **119 tests passed, zero failed** (all owner/new settlement tests and existing payment, Boostero, Guardian, bundle, AutoLikes, AI tests). Next.js production build passed. Protected Vercel Preview READY.
- **No real payments, supplier orders, refill requests or customer changes made.**

## 2026-10-27 verification follow-up
- Latest production `/api/health`: HTTP 200, `supplierConfigured=true`, `paykingsConfigured=true` (existing customer flow); Instagram customer catalog: HTTP 200 but marked `catalogStatus=cached`, not fresh SMMGLOB wholesale.
- Owner Preview private endpoints `/api/owner/wholesale?view=catalog`, `balances`, `orders` returned **HTTP 401** without an authenticated owner cookie. `/owner/wholesale/login` returned HTTP 503 because complete Auth0 application settings remain missing. No wholesale fields leaked in the blocked responses.
- Verified existing Preview Client IDs do not match across the two app configurations. Do not guess or copy incompatible client secrets. No connected Auth0 management plugin available.
- Preview redeployed after staging-only Neon connection configuration and is **READY**; no production modifications or real orders.
