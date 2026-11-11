#!/usr/bin/env bash
set -euo pipefail
# Usage from the live Litix repository: bash /path/to/litix-trusted-seo/deploy-trusted-litix.sh
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$PATCH_DIR/scripts/apply-seo.cjs"
npm run build
printf 'SEO patch compiled. Confirm all routes in Vercel preview before production promotion.\n'
# Deploy with your established Vercel/Git workflow after preview review; not automatically here.
