# Litix Project — Default Save and Handoff Rules

Last updated: 2026-10-29

## User's standing instruction
For all Litix work, by default preserve the work in all four places:
1. This ChatGPT conversation: leave a clear status/handoff summary in the chat.
2. GitHub: commit project code and durable project notes to the connected repository.
3. Vercel: keep the relevant connected project environment/deployment state aligned and verify deployment status.
4. ZIP: create a downloadable project archive/handoff bundle for the user.

Do not treat a chat-only answer, ZIP-only handoff, or unverified deployment as completion. Do not claim a deployment or feature works until checked. Keep the primary production domain litix.net unchanged unless the user explicitly authorizes a production change.

## Project identifiers
- GitHub repository: LitGnosis/Litix
- Current catalog-fix branch: fix/boostero-only-catalog-checkout
- Backup Vercel project/domain: litixbackup / litixbackup.vercel.app
- Primary Vercel project: litix_final_logo_corrected_vercel_ready
- Primary domain: litix.net (preserve unchanged by default)

## Current supplier direction
- Boostero only for the current catalog/fulfillment direction.
- Do not reintroduce SMMFOLLOWOM or SmmGlob into this current branch/configuration.
- Boostero API base URL: https://boostero.com/api/v2
- Required Vercel secret variable name: BOOSTERO_API_KEY
- Never commit supplier keys, payment secrets, or other credentials to GitHub or put them in a ZIP. Store credentials only as protected Vercel environment variables. If a secret is pasted into chat, recommend rotation and do not repeat its value in project documentation.

## Catalog fix
The catalog-fix branch removes restrictive filtering that previously excluded service IDs 33771–33773, non-default types, US-specific services, refill/non-drop variants, and mixed geography. It validates/deduplicates structurally valid services. Purchasability logic still needs to be verified against the actual catalog and checkout behavior.

Relevant commits previously identified:
- 53fad23b0f962458bb259457a843168d27a4816d
- 5719207d10e3237b9222a1ad703d4bd22336f6fb
- 655db025b191a71308e5110ad07f9a288922bc2a

## Checkout safety / verification
- PayKings/NMI Collect.js script: https://secure.nmi.com/token/Collect.js
- Use the public tokenization key in browser only; private gateway credentials remain server-side.
- Expected secure field IDs: ccnumber, ccexp, cvv.
- Never make a real charge without explicit approval for the exact amount.
- Do not claim mobile tokenization, payment capture, or supplier fulfillment works without independent end-to-end verification.
- Verify build status, catalog API response/count, browser checkout tokenization, server-side payment result, and supplier dispatch separately.

## Save-and-release checklist for future Litix changes
- [ ] Update the correct GitHub branch and commit code/documentation.
- [ ] Keep all secrets out of source control, chat summaries, and ZIP archives.
- [ ] Align required environment-variable names/targets in the correct Vercel project; never expose secret values.
- [ ] Trigger/inspect the relevant deployment and record its actual state and commit.
- [ ] Test affected live/preview endpoints and record results without making unauthorized real charges.
- [ ] Create a ZIP of the relevant repository/project state plus this handoff note; state clearly if it is a source snapshot rather than a full production backup.
- [ ] Report what was saved, exact links/commit/deployment state, and anything still unverified.
