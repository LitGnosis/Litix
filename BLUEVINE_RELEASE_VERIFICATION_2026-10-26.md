# Bluevine manual verification and release record — 2026-10-26

Verification source: account owner explicitly confirmed directly opening all four Bluevine hosted payment pages, confirming correct displayed amount and link behavior. Their verification is accepted; automated link inspection restrictions must not be interpreted as payment failures.

| Tier | Exact fixed amount | Owner-verified hosted checkout link |
|---|---:|---|
| Launch | $53.82 | https://pay.bluevine.com/p/ecd2c080f8a74e33ac834ed0e9eedc92 |
| Momentum | $107.82 | https://pay.bluevine.com/p/23d4ce5549c846b6b50dd4ce233b7723 |
| Power | $197.82 | https://pay.bluevine.com/p/5583a248578d48649bb5151c76eb7d4d |
| Apex | $359.82 | https://pay.bluevine.com/p/ae9473e7c1d44aa6bbed123843d945c5 |

The exact same fixed amount applies to each corresponding Instagram and TikTok bundle. Existing PayKings checkout and all other prices remain untouched.

Production Neon project: fancy-wave-75069167, branch br-long-term-awmdp29b, database neondb. Live production Vercel's configured LITIX_AUTOLIKES_DATABASE_URL hostname matches the Neon default branch endpoint. Production bundle database selection also supports an explicit LITIX_BUNDLES_DATABASE_URL if set; validate the actual resolved database before any additional migration.

Recovery: Existing Neon snapshot 2026-10-25 retained unchanged. A new snapshot and Neon branch were both declined by plan quota; no old restore points were deleted. A recoverable table-level copy of the original 21-column growth bundle orders table was created as `litix_release_backup_20261026.growth_bundle_orders_pre_bluevine` before the additive migration, with PUBLIC schema access revoked. Verified source/backup rows 0/0 and original columns 21/21. The copy is in the same database and is **not** an independent full-database disaster recovery image.

Applied additive migration: exactly 3 columns and 2 indexes, no destructive commands, 24 live table columns. No prior orders, customer rows, or unrelated gateway records changed.

Payment reconciliation: Redirect and return never mean paid. The Bluevine orders API creates `awaiting_payment`; a separately authenticated merchant must inspect Bluevine and confirm matching amount and unique reference before `settled`. Owner and customer receive pending notifications separately (clearly labeled UNPAID); existing paid confirmation and owner settled alerts are triggered only after verification.

Verification tests: GitHub Actions isolated no-charge tests and mobile browser simulations; see the PR checks. Production activation must wait for passing checks and a verified deployment. No real payments are used during simulation.
