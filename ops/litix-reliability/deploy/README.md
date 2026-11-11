# Litix dedicated reliability worker — guarded Linux deployment

## Scope and status
This installs only first-party, evidence-driven order telemetry and signed reseller webhooks for explicitly approved `website_preview` and `owned_app_qa` workloads. It **does not** execute SMM engagement, headless account activity, refunds, automated refills, stream watching or purchases. Neither unit is activated by installation.

This is a **dedicated Linux VM or private container host** deployment, **not** an Ubuntu/systemd layer inside Vercel. Vercel hosts the Next.js storefront separately. Redis and Neon may be managed remote services; the shown `localhost` credentials in the user's pasted example were not verified and should never be used as production credentials.

## Prerequisites
- A dedicated, controlled Ubuntu/Linux worker with Python 3.11+, `python3-venv`, systemd, outbound access only to approved Neon, Redis and webhook endpoints, and an operator who can perform deployment.
- Code reviewed on the exact Git SHA from PR #185 (and prerequisites from draft PR #183); both schema migrations reviewed and proven on an isolated staging DB with signed event fixtures, Redis reconnect, and crash recovery tests.
- Approved offline Python wheelhouse from a trusted CI build; pin and audit transitive dependencies before enabling. No `sudo pip`, `pip install --upgrade pip`, or unattended apt updates.
- Dedicated least-privilege Neon DB role and Redis ACL. Use TLS for external traffic, firewall Redis ingress, rotate keys, do not store bearer tokens or payment keys in the GitHub tree.
- Correct `/etc/litix/reliability.env` secret values set on host, protected `root:litix 0640`. **Never** commit real `DATABASE_URL`, `REDIS_URL`, callback signing secrets, or credential screenshots. Avoid using the same token for payment verification and telemetry authentication.
- Independent account confirmation of existing paid-order obligations and issue #167, which this service deliberately does not change.

## Installation (only on authorized Linux worker)
Run from the reviewed `ops/litix-reliability/` directory:
```bash
sudo env LITIX_APPROVED_WHEELHOUSE=/srv/approved-wheels ./deploy/install-on-vm.sh --apply "$PWD"
```
Installation prepares the non-root `litix` system account, copies reviewed files into `/opt/litix/reliability`, installs dependencies from the approved offline wheelhouse, and places hardened units under `/etc/systemd/system/`. The units are **not enabled or started**.

Set `/etc/litix/reliability.env` securely with `LITIX_OWNED_TELEMETRY_ENABLED=true` only after the specific authorized telemetry feed exists. If using verified reseller callbacks, configure the signed, allowlisted webhook destinations and independently set `LITIX_OWNED_WEBHOOKS_ENABLED=true`. No user-controlled URL is allowed. The preflight checks required DB tables and Redis PING before a service can start.

```bash
sudo systemctl daemon-reload
sudo systemctl start litix-telemetry
sudo systemctl status --no-pager litix-telemetry
sudo journalctl -u litix-telemetry --no-pager -n 60
# After staged success and approved operations sign-off:
sudo systemctl enable litix-telemetry
# Separately: sudo systemctl start litix-webhooks
```

To stop or contain a problem:
```bash
sudo systemctl disable --now litix-telemetry litix-webhooks
```

## Operational security
- Disable public inbound traffic to workers; use private TLS and least-privilege security groups.
- Test denial of an invalid signature, duplicate events, replay, DB outage, Redis restart, loss of authorization, webhook DNS rebinding and callback 429/5xx.
- Monitor queue age, pending Redis stream entries, Neon latency, delivery-outbox retries and process restarts; do not represent synthetic simulator metrics as live sales.
- Never deploy the user's suggested `User=root` service, fake timestamp order IDs, plaintext credential rows, IP-rotation evasion or Android taps. Status telemetry is **not** proof of external social engagement delivery.
- Script installation does not migrate databases, change customer funds, or modify Vercel, Boostero or payment webhooks.

## Production gate
The connected Vercel Redis marketplace installation alone does not prove a usable `REDIS_URL` for this worker. The connected production Neon branch had no `growth_ops` master-node tables when last checked, and PRs #183 and #185 remain unmerged. Full activation therefore remains **blocked** until connections, migrations, auth, staging end-to-end test and licensed work sources are verified.
