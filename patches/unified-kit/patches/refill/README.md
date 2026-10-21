# Litix production-source integration release (Oct 19, 2026)

**Additive patch ONLY. This archive is NOT a complete deployment. No GitHub commit or production deployment performed.**

## Goals
- Keep **Instagram, TikTok, YouTube** only in the custom storefront catalog.
- Supplier must report `refill:true` AND explicitly label 365 days / 1 year / 12 months / lifetime (as verified in live catalog); no fallback to an unprotected service.
- Customer custom retail rate: exactly **8× the actual supplier's USD per 1000**; pricing is validated server-side. Preset bundle pricing is not edited by this patch.
- New eligible orders: refill expiration stored as 365 days. Existing orders unaffected.
- Preview-only internal mock route: `/api/internal/checkout-canary`, `POST`, Bearer `LITIX_MOCK_TEST_SECRET` (>=32 characters). No PayKings/Collect.js network call, no card charge, no SmmGlob `add`, `refill`, or `status` write. The mock does not certify payment settlement or automatic post-delivery monitoring.

## Integration into *complete latest* GitHub checkout
Keep this package in a separate folder next to the real repository. Run the installer from within the repo, pointing to its path in the separate package. The installer installs the helper and mock route itself. Only after installation, copy the package's `scripts/`, `tests/`, and `.github/workflows/` to the repository, merging without overwriting unrelated files.

```sh
node --test /path/to/release/tests/policy.test.mjs /path/to/release/tests/source-patch.test.mjs
# Run these commands from the root of the complete current Git checkout:
node /path/to/release/scripts/apply-to-current-litix.mjs --check
node /path/to/release/scripts/apply-to-current-litix.mjs
# Merge release scripts/, tests/ and .github/workflows/ into repo root; inspect git diff.
cd src && npm ci && npm run build
# Review git diff, create commit, and let the connected Vercel Git integration deploy.
```

The current Litix Next.js app lives under `src/`. Run npm commands from inside that directory, and keep `scripts` and `tests` at the repository root. Do not replace the existing Vercel `vercel.json` cron setup, premium frontend, or PayKings checkout with a generic HTML dashboard or `/api/checkout.js` file.

## Smoke checks required in preview before production
- `GET /api/services` returns only Instagram/TikTok/YouTube, with `refill:true` and `refillTermDays:365` for every item.
- Test direct service IDs for Facebook, X, Snapchat, unprotected followers and protected SmmGlob services; only matching protected products pass.
- Verify pricing for known supplier rates and realistic quantities, and check checkout total matches display.
- Verify old customer orders remain readable and preset bundle prices are unchanged.
- The mock route should report simulated tokenization and calculated retail, all charge/settlement/supplier flags FALSE.
- Validate PayKings in authorized test mode separately; never send synthetic payment tokens to live NMI. Then verify a real settlement/fulfillment only using an explicitly authorized live test order.
- Inspect actual supplier status/refill policies, webhook receipt, and post-completion loss monitoring. Litix's existing auto-refill worker acts on `Partial`; it does not by itself detect all drops after `Completed`.

## Important provider limits
SmmGlob's authenticated catalog at this time shows explicit 365-day options on Instagram, TikTok and YouTube. A supplier's named term is a *claim*, not an independently certified guarantee. Expose truthful protection terms on order details/terms, without needing a homepage promotional banner.

## No fabricated Git confirmation
No GitHub commit hash is included. Repository commit requires a code-write-capable connection to `LitGnosis/Litix` or running the included patch within the real checkout. Vercel's Git deployment connection can build existing commits but does not accept file edits to GitHub.
