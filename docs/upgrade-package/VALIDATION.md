# Uploaded iPhone storefront upgrade

Source baseline: fix/smmglob-paid-fulfillment, 39f7f1b4abd03417cdefd6b5c9f9bdde6150115d.
Uploaded ZIP sha256: 22bc3b9dfc724fc2e7438d6208ae2bccc94aa77b05d408d67ebec8c2df1eefb2.
All six ZIP files installed (README under docs/upgrade-package; logo/scripts under src). Manifest records original hashes. Catalog script/source corrected for generated regex escaping and retention of Instagram followers. Unsupported global instant-delivery/programmatic-refill claims changed to service-specific wording. No made-up service IDs, no monthly/Auth0 branch merged.

Rollback references: observed www.litix.net target dpl_iaihLawqQM81nb9gXiApjgAX1gZa (bedic7mbu); user-specified previously working target dpl_3YwzYiXPFTcbvEDF5WGeJQhgDzLv (7cvuhhek3), both Ready at inspection. Earlier session observed a different production target; no promotion performed by this task.

Twenty local tests pass. Checkout tests replace only database transport and intercept every supplier/gateway fetch: no real charge/order. Collect.js lifecycle tests run actual effect with mocked DOM/transport/polling; repaired stale baseline harness extraction and selector/color assertions without changing production controls. Added supplier-shaped fixture coverage for requested engagement kinds, supplier IDs, min/max, 5x prices, sorting and filtering. Fixtures are NOT live SMMGLOB catalog evidence. Existing price floor of $1 retained.

Clean Next build must be recorded separately. Existing baseline config skips lint/types and emits bulk-route export warnings; do not describe build as full lint/type coverage.

External Preview browser/mobile checks, real catalog/API availability, product mapping, hosted gateway fields, payment confirmation and tracking remain unverified: sandbox cannot request deployment/supplier hosts. No real transactions or supplier purchases authorized. Only after Preview passes these checks may production be staged without aliases. User approval required for subsequent promotion of that exact verified artifact without rebuild.

Payment/supplier checkout implementation remains baseline except catalog eligibility/sort/filter changes; no keys, webhooks, tracking schema, database, domains or production settings changed. No recurring integration included. ZIP has no transactional-email integration.
