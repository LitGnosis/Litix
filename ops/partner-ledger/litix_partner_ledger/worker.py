from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from urllib.parse import parse_qs, urlsplit

from .models import DeliveryObservation, review_state, verify_observation

STREAM = "litix:partner:delivery:evidence"
GROUP = "litix_partner_evidence_v1"
QUARANTINE = "litix:partner:delivery:quarantine"
LOG = logging.getLogger("litix.partner.evidence")


class UntrustedObservation(ValueError):
    pass


def validate_runtime(env: dict[str, str]) -> None:
    if env.get("LITIX_PARTNER_EVIDENCE_ENABLED") != "true":
        raise RuntimeError("partner_evidence_disabled")
    database = env.get("DATABASE_URL", "")
    redis_url = env.get("REDIS_URL", "")
    secret = env.get("LITIX_PARTNER_EVIDENCE_SECRET", "")
    db = urlsplit(database)
    q = urlsplit(redis_url)
    if db.scheme not in ("postgres", "postgresql") or not db.hostname or (
        parse_qs(db.query).get("sslmode", [""])[0]
        not in ("require", "verify-ca", "verify-full")
    ):
        raise RuntimeError("postgres_tls_not_configured")
    if q.scheme != "rediss" or not q.hostname:
        raise RuntimeError("redis_tls_not_configured")
    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError("evidence_signing_secret_missing")


async def store_observation(pool, event: DeliveryObservation) -> str:
    async with pool.acquire() as db:
        async with db.transaction():
            order = await db.fetchrow(
                """SELECT id, requested_units, observed_units, delivery_state,
                          last_observed_at
                   FROM growth_ops.wholesale_delivery_orders
                   WHERE id=$1 AND approval_state='approved'
                     AND verified_payment_ref IS NOT NULL
                   FOR UPDATE""", event.order_id
            )
            if order is None:
                raise UntrustedObservation("order_not_paid_or_approved")
            event_key = await db.fetchval(
                """INSERT INTO growth_ops.wholesale_delivery_events
                     (event_id, order_id, observed_units, evidence_sha256, observed_at)
                   VALUES ($1,$2,$3,$4,$5)
                   ON CONFLICT(event_id) DO NOTHING
                   RETURNING event_id""",
                event.event_id, event.order_id, event.observed_units,
                event.evidence_sha256, event.observed_at,
            )
            if event_key is None:
                return "duplicate"
            if (order["last_observed_at"] is not None and
                    event.observed_at <= order["last_observed_at"]):
                return "out_of_order"
            if order["delivery_state"] == "COMPLETED":
                return "immutable_completed"
            state = review_state(
                requested=int(order["requested_units"]),
                observed=event.observed_units,
                previous=int(order["observed_units"]),
                has_evidence=bool(event.evidence_sha256),
            )
            await db.execute(
                """UPDATE growth_ops.wholesale_delivery_orders
                   SET observed_units=$2,
                       delivery_state=$3,
                       evidence_sha256=$4,
                       last_observed_at=$5,
                       updated_at=now()
                   WHERE id=$1 AND delivery_state<>'COMPLETED'""",
                event.order_id, min(event.observed_units, int(order["requested_units"])),
                state, event.evidence_sha256, event.observed_at,
            )
            return state


async def run() -> None:
    from redis.asyncio import Redis
    from redis.exceptions import ResponseError
    import asyncpg

    validate_runtime(dict(os.environ))
    pool = await asyncpg.create_pool(
        dsn=os.environ["DATABASE_URL"], min_size=1, max_size=4, command_timeout=15
    )
    redis = Redis.from_url(
        os.environ["REDIS_URL"], decode_responses=True,
        socket_connect_timeout=8, socket_timeout=10,
    )
    consumer = f"{socket.gethostname()[:24]}-{os.getpid()}"
    secret = os.environ["LITIX_PARTNER_EVIDENCE_SECRET"]
    try:
        await redis.ping()
        try:
            await redis.xgroup_create(STREAM, GROUP, id="0-0", mkstream=True)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

        async def handle(message_id: str, fields: dict[str, str]) -> None:
            try:
                event = verify_observation(
                    fields.get("payload", ""), fields.get("signature", ""), secret
                )
                outcome = await store_observation(pool, event)
                LOG.info("evidence_recorded order=%s state=%s", event.order_id, outcome)
            except ValueError as exc:
                async with redis.pipeline(transaction=True) as pipe:
                    pipe.xadd(
                        QUARANTINE, {"original_id": message_id, "reason": str(exc)[:120]},
                        maxlen=10000, approximate=True
                    )
                    pipe.xack(STREAM, GROUP, message_id)
                    await pipe.execute()
                return
            await redis.xack(STREAM, GROUP, message_id)

        cycles = 0
        while True:
            cycles += 1
            if cycles % 4 == 0:
                recovered = await redis.xautoclaim(
                    STREAM, GROUP, consumer, min_idle_time=60000,
                    start_id="0-0", count=20
                )
                for msg_id, values in recovered[1]:
                    try:
                        await handle(msg_id, values)
                    except Exception:
                        LOG.exception("recovered_evidence_retry_pending")
            received = await redis.xreadgroup(
                GROUP, consumer, streams={STREAM: ">"}, count=20, block=5000
            )
            for _, items in received:
                for msg_id, values in items:
                    try:
                        await handle(msg_id, values)
                    except Exception:
                        LOG.exception("evidence_retry_pending")
                        await asyncio.sleep(1)
    finally:
        await redis.aclose()
        await pool.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(run())
