# Production checkout handoff repair

This source was recovered from the live Litix production deployment of 2026-10-21, not from an older feature branch. It lives under `src` to match the existing Vercel project root. The repository default branch previously contained only a README.

The active PayKings bridge hotfix returns its encrypted, ten-minute session handoff at `/api/payments/paykings/card-entry`, while the storefront's last retirement overlay restricted URLs to NMI hostnames. The repair runs **after** existing build overlays and allows only the exact HTTPS bridge origin/path with one base64url session. Exact order-reference binding remains mandatory. It does not activate payments, weaken merchant readiness, change settlement, or initiate supplier orders.

Builds still depend on the existing environment-supplied legacy overlays. Do not remove those environment variables or deploy an old branch as a replacement without reconciling them. They are not stored here. No credentials or environment files are included.

Verification: regression reproduces the rejected bridge handoff on the old implementation. Tests cover exact path/session and reference validation, malicious destinations, retained direct NMI support and final overlay ordering/idempotency. Local tests and `npm run build` pass. Live card submission, settlement, fulfillment and other site features require separate end-to-end validation; passing builds are not proof of full functionality.
