"""Fail-closed preflight for separately hosted first-party delivery evidence services."""
from __future__ import annotations

import asyncio
import os
import sys
from urllib.parse import urlsplit

REQUIRED_TABLES = (
    "public.master_fulfillment_grants",
    "public.master_node_jobs",
    "growth_ops.litix_owned_delivery_agreements",
    "growth_ops.litix_owned_delivery_events",
    "growth_ops.litix_owned_delivery_progress",
    "growth_ops.litix_owned_delivery_webhook_outbox",
)


def check_uri(name: str, value: str, schemes: tuple[str, ...]) -> None:
    if not value or any(token in value.lower() for token in ("secure_pass", "your_password", "example.com", "localhost:6379")):
        raise RuntimeError(f"{name}_missing_or_sample")
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in schemes or not parsed.hostname:
            raise ValueError("scheme or hostname")
        if parsed.hostname.lower() in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("worker must use explicit approved remote connection")
    except ValueError as exc:
        raise RuntimeError(f"{name}_unusable") from exc


def validate_configuration(mode: str, env: dict[str, str]) -> None:
    if mode not in ("telemetry", "webhooks"):
        raise RuntimeError("unknown_worker_mode")
    if env.get("LITIX_OWNED_" + ("TELEMETRY" if mode == "telemetry" else "WEBHOOKS") + "_ENABLED") != "true":
        raise RuntimeError("worker_disabled_until_approved")
    check_uri("DATABASE_URL", env.get("DATABASE_URL", ""), ("postgresql", "postgres"))
    if mode == "telemetry":
        check_uri("REDIS_URL", env.get("REDIS_URL", ""), ("redis", "rediss"))
        if len(env.get("LITIX_TELEMETRY_SIGNING_SECRET", "").encode("utf-8")) < 32:
            raise RuntimeError("telemetry_signing_secret_missing")
    else:
        if not env.get("LITIX_WEBHOOK_ALLOWED_HOSTS", "").strip():
            raise RuntimeError("no_approved_webhook_hosts")
        if env.get("LITIX_WEBHOOK_ENDPOINT_CONFIG_JSON", "{}").strip() in ("", "{}"):
            raise RuntimeError("no_approved_webhook_destinations")


async def probe(mode: str) -> None:
    import asyncpg

    pg = await asyncpg.connect(dsn=os.environ["DATABASE_URL"], timeout=8)
    try:
        row = await pg.fetchrow(
            "SELECT " + ", ".join(
                f"to_regclass('{table}') IS NOT NULL AS table_{i}" for i, table in enumerate(REQUIRED_TABLES)
            )
        )
        if not all(row.values()):
            raise RuntimeError("owned_delivery_schema_not_installed")
    finally:
        await pg.close()

    if mode == "telemetry":
        from redis.asyncio import Redis
        r = Redis.from_url(os.environ["REDIS_URL"], socket_connect_timeout=6, socket_timeout=6)
        try:
            if not await r.ping():
                raise RuntimeError("redis_ping_failed")
        finally:
            await r.aclose()


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        target = sys.argv[1] if len(sys.argv) == 2 else ""
        validate_configuration(target, dict(os.environ))
        asyncio.run(probe(target))
        logging.info("owned_delivery_preflight_passed mode=%s", target)
    except Exception as exc:
        logging.error("owned_delivery_preflight_failed type=%s", type(exc).__name__)
        sys.exit(1)
