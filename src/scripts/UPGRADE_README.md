# Litix Storefront Upgrade

Prepared against the LitGnosis/Litix source used for the working PayKings checkout (branch `fix/smmglob-paid-fulfillment`, October 24, 2026).

## What this does

- Changes the header to the supplied flame/metal **LITIX — INNOVATION, IGNITED** logo.
- Removes the long hero with feature pills from the top; displays the services/catalog directly below navigation.
- Moves the original feature pills into a **Why shop with Litix** panel near the footer.
- Gives customers three quick catalog tabs: Instagram, TikTok, All Services.
- Sorts supplier listings Instagram, TikTok, YouTube, Facebook, Spotify, then other services.
- Adds eligible TikTok likes, shares, reposts, comments, and views, plus Instagram views, **only when the live SmmGlob API actually provides them**.
- Preserves the existing retail pricing formula `wholesale rate × 5` in both product display and server-side checkout. (This is 400% markup on wholesale cost, producing a 500%-of-cost selling price.)
- Includes the previously tested PayKings Collect.js marker fix so a fresh GitHub deployment doesn't undo the working checkout.
- Preserves existing order tracking/payment API and does not introduce fake supplier services.

## Installation (GitHub/Vercel)

1. Take a backup or open a pull request rather than replacing the live branch directly.
2. From the repository root, copy the folder `public/assets/brand/litix-logo.webp` from this ZIP to **`src/public/assets/brand/litix-logo.webp`**.
3. Copy the scripts in `scripts/` from this ZIP to **`src/scripts/`**.
4. In the repo's `src` folder run:

   ```bash
   node scripts/apply-all.cjs
   node --test tests/checkout.test.mjs
   npm run build
   ```

5. Review catalog output with the connected SmmGlob credentials. Do not assume every requested service type is in stock at every moment.
6. Deploy a Vercel Preview first and verify on mobile, including card field initialization, page order, and all catalog filters. Promote to production only after checks pass.
7. Commit both the source edits and new logo to GitHub. Without this, a Git redeployment could restore the old storefront.

## Important details

- This ZIP does not include API keys or payment credentials.
- A successful build proves the code compiles, not that any specific TikTok service is supplied at this moment. The production catalog must confirm live availability and provider price, service ID, minimum and maximum before checkout.
- The app's original supplier gating required USA + refill + no-drop. This upgrade relaxes that combined requirement for Instagram/TikTok engagement products, so **do not represent these products as US-targeted, refillable, or non-drop unless the supplier states so**.
- No email-receipt integration is included; that is a separate pending change.
