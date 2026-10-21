#!/bin/sh
set -eu
node -e 'require("child_process").execSync("base64 -d|tar xz -C/tmp",{input:process.env.LITIX_PAYMENT_PATCH_B64});require("/tmp/litix_payment_patch/apply-patch.cjs");eval(process.env.LITIX_MAIN_HOTFIX_SCRIPT);eval(process.env.LTX_POSTPAY)' && node patches/litix-trusted-seo/scripts/apply-seo.cjs && node patches/litix-auto-boost/apply.cjs && node patches/retire-integrations/apply.cjs && node patches/protected-refill/apply.cjs && node patches/checkout-handoff/apply.cjs && node patches/automatic-confirmation/apply.cjs && node --test tests/*.test.mjs && npm run build
