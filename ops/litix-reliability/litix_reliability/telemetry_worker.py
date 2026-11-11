"""Redis Streams -> verified Neon delivery evidence -> durable webhook outbox.

This worker cannot create supplier orders, send refills, move money, or simulate
third-party likes/follows/views. It processes approved first-party work only.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
import socket
from typing import Any

from .models import assess, verified_event, Event

STREAM = "litix:owned:delivery:telemetry"
GROUP = "litix_owned_telemetry_v1"
REJECTIONS = "litix:owned:delivery:quarantine"
log = logging.getLogger("litix.first_party.telemetry")

class UnapprovedEvent(ValueError):
    pass

async def store_event(pool: Any, event: Event) -> str:
    async with pool.acquire() as db:
        async with db.transaction():
            agreement = await db.fetchrow(
                """SELECT a.order_id,a.kind,a.target_units,a.client_order_id,
                          a.endpoint_key,a.approval_state,g.revoked_at,g.expires_at,
                          j.status AS execution_status,
                          j.result->>'evidence_ref' AS execution_proof
                   FROM growth_ops.litix_owned_delivery_agreements a
                   JOIN public.master_fulfillment_grants g ON g.order_id=a.order_id
                   LEFT JOIN public.master_node_jobs j ON j.order_id=a.order_id
                   WHERE a.order_id=$1 AND g.kind=a.kind
                   FOR UPDATE OF a""",event.order_id)
            now = datetime.now(timezone.utc)
            if (not agreement or agreement["approval_state"]!="approved" or
                agreement["kind"]!=event.kind or agreement["revoked_at"] is not None or
                (agreement["expires_at"] is not None and agreement["expires_at"]<=now)):
                raise UnapprovedEvent("no_active_verified_first_party_agreement")

            new = await db.fetchval(
                """INSERT INTO growth_ops.litix_owned_delivery_events
                   (event_id,order_id,kind,reported_units,evidence_ref,observed_at)
                   VALUES($1,$2,$3,$4,$5,$6)
                   ON CONFLICT(event_id) DO NOTHING RETURNING event_id""",
                event.event_id,event.order_id,event.kind,event.observed_units,
                event.evidence_ref,event.observed_at)
            if new is None:
                return "duplicate"

            old = await db.fetchrow(
                """SELECT reported_units,last_observed_at
                   FROM growth_ops.litix_owned_delivery_progress
                   WHERE order_id=$1 FOR UPDATE""",event.order_id)
            if old and old["last_observed_at"] and old["last_observed_at"]>event.observed_at:
                return "out_of_order_ignored"

            attested = bool(agreement["execution_status"]=="succeeded" and
                            event.evidence_ref and
                            event.evidence_ref==agreement["execution_proof"])
            snapshot = assess(target=int(agreement["target_units"]),
                              current=event.observed_units,
                              previous=int(old["reported_units"]) if old else None,
                              completed_with_matching_evidence=attested)
            await db.execute(
                """INSERT INTO growth_ops.litix_owned_delivery_progress
                   (order_id,reported_units,status,remaining_units,last_observed_at,evidence_ref)
                   VALUES($1,$2,$3,$4,$5,$6)
                   ON CONFLICT(order_id) DO UPDATE SET
                     reported_units=EXCLUDED.reported_units,status=EXCLUDED.status,
                     remaining_units=EXCLUDED.remaining_units,
                     last_observed_at=EXCLUDED.last_observed_at,
                     evidence_ref=EXCLUDED.evidence_ref,updated_at=now()""",
                event.order_id,event.observed_units,snapshot.status,snapshot.remains,
                event.observed_at,event.evidence_ref)

            if agreement["endpoint_key"]:
                status_data={
                    "event_id":str(event.event_id),
                    "order_id":event.order_id,
                    "client_order_id":agreement["client_order_id"],
                    "status":snapshot.status,
                    "remains":snapshot.remains,
                    "current_count":event.observed_units,
                    "requires_review":snapshot.needs_review,
                    "observed_at":event.observed_at.isoformat(),
                }
                await db.execute(
                    """INSERT INTO growth_ops.litix_owned_delivery_webhook_outbox
                       (event_id,order_id,endpoint_key,payload)
                       VALUES($1,$2,$3,$4::jsonb)
                       ON CONFLICT(event_id,endpoint_key) DO NOTHING""",
                    event.event_id,event.order_id,agreement["endpoint_key"],
                    json.dumps(status_data))
            return snapshot.status

async def run() -> None:
    import asyncpg
    from redis.asyncio import Redis
    from redis.exceptions import ResponseError

    if os.getenv("LITIX_OWNED_TELEMETRY_ENABLED")!="true":
        raise RuntimeError("telemetry_disabled")
    database=os.getenv("DATABASE_URL","")
    redis_url=os.getenv("REDIS_URL","")
    key=os.getenv("LITIX_TELEMETRY_SIGNING_SECRET","")
    if not database or not redis_url or len(key.encode())<32:
        raise RuntimeError("private_telemetry_dependencies_missing")
    pg=await asyncpg.create_pool(dsn=database,min_size=1,max_size=4,command_timeout=15)
    redis=Redis.from_url(redis_url,decode_responses=True,socket_timeout=10)
    consumer=f"{socket.gethostname()[:30]}-{os.getpid()}"
    try:
        try:
            await redis.xgroup_create(STREAM,GROUP,id="0-0",mkstream=True)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

        async def handle(message_id:str, fields:dict[str,str]) -> None:
            try:
                event=verified_event(fields.get("payload",""),fields.get("signature",""),key)
                result=await store_event(pg,event)
                log.info("verified_first_party_telemetry order=%s state=%s",event.order_id,result)
            except ValueError as exc:
                # Atomic rejected-event audit and ACK. No automatic refill/reorder.
                pipeline=redis.pipeline(transaction=True)
                pipeline.xadd(REJECTIONS,{"stream_id":message_id,"reason":str(exc)[:100]},
                              maxlen=10000,approximate=True)
                pipeline.xack(STREAM,GROUP,message_id)
                await pipeline.execute()
                return
            await redis.xack(STREAM,GROUP,message_id)

        tick=0
        while True:
            tick+=1
            if tick%4==0:
                claims=await redis.xautoclaim(STREAM,GROUP,consumer,min_idle_time=60000,
                                              start_id="0-0",count=25)
                for mid,fields in claims[1]:
                    try:
                        await handle(mid,fields)
                    except Exception:
                        log.exception("pending_event_recovery_will_retry")
            batch=await redis.xreadgroup(GROUP,consumer,{STREAM:">"},count=25,block=5000)
            for _,items in batch:
                for mid,fields in items:
                    try:
                        await handle(mid,fields)
                    except Exception:
                        log.exception("database_commit_failed; Redis event retained")
                        await asyncio.sleep(2)
    finally:
        await redis.aclose()
        await pg.close()

if __name__=="__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
