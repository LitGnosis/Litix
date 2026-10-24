# Auto Engagement preview — not a paid product

Based on the currently promoted fix/resilient-storefront revision. The existing storefront, prices, gateway and single-order dispatch are untouched. Visit /auto-engagement directly; it is intentionally not advertised as a purchasable product on the home page.

The draft API accepts only validateDraft. All execution actions fail closed, regardless of supplied payment flags, service IDs or amounts. It does not call suppliers, collect email, create accounts, save drafts, collect payment, or execute migrations. Likes and views both remain not_submitted. USD amount is null, not zero. The fixed 3:1 preference is not an algorithmic or organic-activity claim. Input caps are draft safety limits, not verified supplier limits.

## Existing work reviewed

PR #16 prepares subscription modules against an older follower-checkout branch. Its description explicitly leaves exact service support, database integration and checkout activation unverified. Do not merge its old storefront or attach its settlement adapter to this live checkout: this checkout records litix_v2_orders and dispatches inline; it does not use that older outbox contract.

## Activation gates (not implemented in this PR)

1. Read-only authenticated supplier catalog and contract verification: confirm separate likes/views subscription types, platform, username syntax, posts semantics, mandatory delay, min/max, billing per future post, status and cancellation. Preserve provider-qualified IDs. Never infer subscription support from a service name.
2. Authenticated customer/account ownership. Email alone or a browser-supplied paid flag is not authorization.
3. Immutable, expiring server quote in USD: service IDs, provider, limits, post count and maximum funded obligation, calculated markup and transparent customer price. Unknown subscription billing means no payable quote. Revalidate before accepting payment.
4. Durable parent order plus two distinct leg rows. Unique customer/idempotency key and unique payment transaction prevent repeated settlement from funding multiple subscriptions. Insert and claim in database transactions, not memory. Do not reuse the bulk ledger without schema/ownership review.
5. Only server-verified settlement matching order, customer, amount and currency may move either leg from awaiting_payment to dispatch_pending. A declined or uncertain payment never dispatches.
6. Claim each leg atomically before supplier submission. Record attempt before network I/O. A timeout, malformed acknowledgement or missing order ID becomes unknown_outcome; never retry automatically. Explicit rejection becomes rejected. A valid supplier ID becomes submitted, not completed.
7. Track both legs separately. One submitted and one rejected/unknown yields partial_review, not aggregate success. Reconcile the uncertain leg before retrying. A retry must not resubmit the acknowledged leg. Establish cancellation/refund responsibility before selling this pair.
8. Mock duplicate settlement, concurrent workers, mismatch, decline, missing IDs, supplier errors, partial success, timeout and status/cancellation. Then perform authorized sandbox integration checks before any production activation. Never test with real supplier add calls merely to verify connectivity.

No activation switch is included: setting an environment variable cannot bypass these missing integrations. A separate reviewed implementation and approval are required before production changes.

Public provider evidence checked 2026-10-24: https://smmglob.com/api-docs documents POST /api/v2 with action=add, service, link, quantity and optional runs/interval. The retrieved documentation does not establish username/min/max/posts subscription semantics. This is a verification gap, not proof the provider cannot support subscriptions. Obtain the exact subscription-specific contract and eligible services before quoting or dispatching.

## Monthly simulator

/auto-engagement/sandbox is an in-memory, browser-only simulation, not NMI sandbox integration. Prices approved from owner screenshots: 100 likes $5.60, 150 $8.00, 250 $12.00, 1,000 $32.00, 2,000 $56.00 USD/month. Do not infer missing 50/500 tier prices or claim Leofame uses recurring billing. Supplier margins remain unverified. This simulation includes likes only; it makes no promise of included views.

Proposed allowance: three eligible posts per UTC calendar day. Explicit monthly renewal consent; cancel anytime stops future simulated renewals and preserves current-period simulated coverage. Calendar month ends clamp to the final day when necessary. These are proposed semantics, not production billing guarantees. Cancellation is idempotent within the simulation, declined renewals do not add coverage, and duplicate post IDs do not consume allowance twice. No account, billing email, durable ledger, authenticated cancellation endpoint or real recurring gateway call is implemented. Refreshing erases the simulation. Never treat client state as a paid entitlement.

## Live-billing integration preparation

Internal cancellation adapter added based on NMI Classic recurring documentation (https://support.nmi.com/hc/en-gb/articles/14525725002385-API-Recurring-Payments-and-Subscriptions). It issues delete_subscription only, never a charge. It is deliberately not wired to a public endpoint: authenticated ownership, durable cancellation intent/attempt records and reconciliation must precede exposure. Timeout, malformed/duplicate response fields and HTTP errors require review, not success or blind retry. No real cancellation was sent.

User permission to prepare a controlled live test does not approve any particular charge. Before a test, disclose exact amount, first charge date, subsequent charge schedule and cancellation method, then obtain explicit approval. Supplier fulfillment stays off. Do not use creation acknowledgement as evidence of a paid billing period. Creation/verified settlement and durable authenticated cancellation remain unfinished; this adapter alone does not make the product ready.
