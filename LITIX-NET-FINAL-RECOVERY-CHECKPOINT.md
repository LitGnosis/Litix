# Litix.net Final — Recovery checkpoint (October 29, 2026)

## Immutable production code
- Repository: LitGnosis/Litix
- Production source SHA: `51435047863ad67943a9f4e36a95d2f5bdf6392e`
- Frozen GitHub branch: `backup/litix-net-final-20261029`
- Download exact entire repository as ZIP: https://github.com/LitGnosis/Litix/archive/51435047863ad67943a9f4e36a95d2f5bdf6392e.zip
- Original Vercel project: `litix_final_logo_corrected_vercel_ready` (`prj_ATrABQBmZbBlw3mpz04Pvnu7AxXv`)
- Production READY deployment: `dpl_2vw3CtQ29Vw1S4oihFJHfjLgGiSv`
- Domains verified on that deployment: `litix.net`, `www.litix.net`
- Second independent Vercel recovery build: `dpl_7pBmRxSnBmD9w8vHab1Vpehygtt5`, project `litixbackup`; source commit identical, not promoted over the prior backup domain

## Newer main branch infrastructure checkpoint
- Main source SHA: `825c1845c4541851a287c554cf7b669843af86c6`
- Frozen branch: `backup/litix-main-infrastructure-20261029`
- Download full infrastructure snapshot: https://github.com/LitGnosis/Litix/archive/825c1845c4541851a287c554cf7b669843af86c6.zip

## Security and restoration
- Keep the Vercel environment variables, API keys, NMI security key, OAuth/Auth0 secrets, Boostero credentials, Resend credentials, and Neon DB passwords in protected secret stores. **Do not place them in a GitHub branch, public ZIP, or chat.**
- No new encrypted Cloudflare R2 / Neon data backup was verified in this recovery checkpoint. Backup/restore of customer data must be handled separately and verified in an isolated environment.
- The recovered source includes the Boostero-only catalog, PayKings checkout, Bluevine bundle functionality, logo, Litix AI, order notifications, tracking and $1 minimum, with supplier cost + 60% pricing.
- A previously confirmed customer purchase is historical evidence only: do not replay a payment or supplier submission during restore.
- Do not replace the production deployed commit with `main` blindly: there are diverged changes including infrastructure backups on main.
