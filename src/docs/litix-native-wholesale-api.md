# Litix Native — Partner Trial API (Phase 2)

This API is **not** a paid SMM supplier and cannot provide artificially generated followers, likes, or views. It produces only original, creator-owned digital assets.

## Current behavior

- **GET** /api/native/v1/reseller — public original-service discovery: names, actions, types, \`trialPriceCents: 0\`, \`paidCheckoutEnabled: false\`.
- **POST** /api/native/v1/reseller — authenticated partner trial API, disabled by default.
- Action \`add\`: supply a unique \`requestId\`, \`serviceId\`, and creator brief. Records a completed **no-charge** generated original file, returning \`orderId\`, \`filename\`, \`sha256\`, \`content\`, and \`replayed\`.
- Action \`status\`: supply existing \`orderId\`. Returns private partner order metadata and optionally content if \`includeAsset: true\`.
- Neither route charges, refunds, accesses the Boostero API, sends email or modifies existing Litix orders.

### Example

Headers:
- \`Content-Type: application/json\`
- \`Authorization: Bearer <partner-issued-secret>\`

Request body:
\`\`\`json
{
 "action": "add",
 "requestId": "example-unique-order-0001",
 "serviceId": "litix-native-caption-kit",
 "brief": {
   "business": "Example Studio",
   "audience": "independent creators",
   "offer": "a weekly content planning service",
   "action": "Book a consultation",
   "platform": "Instagram"
 }
}
\`\`\`
Response on first success: HTTP 201, \`status: COMPLETED\`, \`charged: false\`, \`costCents: 0\`. A repeat with identical output returns HTTP 200 and \`replayed:true\`. A repeated request ID with conflicting output is HTTP 409. Unknown or unpaid engagement SKUs are rejected.

### Provisioning — never commit API keys

1. Review and apply \`src/db/litix_native_partner_trial.sql\` in an isolated Neon test branch, then production only after backup and QA.
2. In Vercel **server-only** environment variables, configure:
   - \`LITIX_NATIVE_PARTNER_ORDERS_ENABLED=true\` (leave false until all checks pass);
   - \`LITIX_NATIVE_DATABASE_URL\` (existing approved dedicated DB branch or connection);
   - \`LITIX_NATIVE_PARTNER_API_CONFIG={"partners":[{"id":"agency-sample","keyHash":"<SHA-256-of-random-48-byte-partner-key>","maxDaily":25}]}\`.
3. Generate each partner key through a trusted secret manager. Do not paste raw credentials in chat or source control; deliver them only through an authorized secure channel. Hash secrets in configuration, rotate/revoke without deployment as supported.
4. Add platform-level WAF rate limits. Library's daily quota is a soft guard and must not be treated as strictly concurrency-atomic under high load.
5. Validate no-charge end-to-end, response integrity, idempotency, unauthorized access, load limits, and tenant separation before connecting any agency.

### Production monetization gates

Implement *separately*: approved SKU prices, authenticated customer intake, authoritative settled PayKings/NMI verification, atomic payment claims, digital download token security, Resend delivery outbox, privacy-retention controls, authorized refunds, and a genuine agency wholesale agreement. NEVER enable payment intake merely by toggling the free-trial flag.

A first-party service provider means Litix can **create and deliver** a real asset itself. It is not a source of authentic social platform engagement without genuine distribution inventory.
