# Litix verified working production recovery reference — 2026-10-28

## Immutable recovery checkpoint
- Project: `litix_final_logo_corrected_vercel_ready`
- Project ID: `prj_ATrABQBmZbBlw3mpz04Pvnu7AxXv`
- Production domains: `www.litix.net`, `litix.net` (apex redirects to www).
- Protected live deployment: `dpl_68nf7SLM7QBztTTPVzHrqrsV7qhY`
- Vercel inspector: https://vercel.com/litgnosisllc-9049/litix_final_logo_corrected_vercel_ready/68nf7SLM7QBztTTPVzHrqrsV7qhY
- Working source commit: `a4d1d152fda00444242174bc4b668c08a18648f8`
- Reconciled source candidate: `396d4cc1797ef5abef835382b1f8be2761bd6aa9` (NOT automatically approved for live promotion).

## Verified non-destructive production checks
- `GET https://www.litix.net/`: HTTP 200.
- `GET /api/catalog/v1`: HTTP 200; Boostero-only allowlisted cards for Instagram Followers (5461), Instagram Likes (4751), TikTok Followers (5101), TikTok Likes (5251).
- `GET /api/config`: HTTP 200; checkout configuration ready with public Collect.js key (key not included here).
- `GET /api/health`: HTTP 200; reports database, supplier, PayKings and order-email configuration ready. This endpoint alone does not prove a completed card payment.
- `GET /api/bundles`: HTTP 200; Launch, Momentum, Power and Apex variants returned.
- `GET /api/smmservices`: HTTP 410; retired supplier disabled.
- Owner reports successful live PayKings payments, Boostero supplier acceptance and owner emails; preserve records and do not repeat live purchases.

## Release safeguards
- Boostero is the ONLY authorized supplier for all new purchases. Do not restore SMMFOLLOWOM/SMMGLOB to public catalog or dispatch.
- Preserve PayKings/NMI, Bluevine bundles, private tracking, verified payment state, order idempotency, email notifications, customer records and branding.
- R2 backup workflow + 8 configured GitHub secrets are independent and preserved; real R2 encrypted dual-DB backup and isolated restore remain unverified.
- Validate the reconciled candidate on a non-production deployment before merging or promoting it.
- Do not silently assign production traffic to new `main` builds before release approval and domain regression checks.
- Never copy secrets, payment tokens, plaintext DB dumps, card data, or customer contact details into this reference.

## Order reconciliation
- Read-only audit on 2026-10-28 identified paid order `ltx2_d54ef06f-2061-4561-b3f6-77f92f1778cb` as `manual_review` with no supplier order ID. Reconcile manually against gateway/provider before any supplier submission. No second payment or supplier add is authorized.
