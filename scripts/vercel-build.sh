#!/bin/sh
set -eu
node -e 'require("child_process").execSync("base64 -d|tar xz -C/tmp",{input:process.env.LITIX_PAYMENT_PATCH_B64});require("/tmp/litix_payment_patch/apply-patch.cjs");eval(process.env.LITIX_MAIN_HOTFIX_SCRIPT);eval(process.env.LTX_POSTPAY)' && node patches/litix-trusted-seo/scripts/apply-seo.cjs && npm run build
