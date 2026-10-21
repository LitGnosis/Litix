// Apply last: legacy environment overlays must not restore unprotected services or 15x prices.
const fs = require('node:fs');
const path = require('node:path');
for (const file of ['lib/provider.js', 'lib/orders.js', 'lib/litixRefillPolicy.mjs', 'app/api/services/route.js', 'app/api/internal/checkout-canary/route.js']) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'assets', file), file);
}
console.log('PROTECTED_REFILL_POLICY_APPLIED');
