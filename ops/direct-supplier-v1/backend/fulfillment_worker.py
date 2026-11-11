"""First-party only: authorized social post observation -> Redis -> owned node dispatch.
Does not perform, simulate, or count fake views, likes or followers.
A node is 'complete' only after its Ed25519-signed receipt is independently verified.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from contextlib import suppress
from datetime import datetime, timezone

import asyncpg
from redis.asyncio import Redis
from redis.exceptions import ResponseError

LOG = logging.getLogger("litix.direct.worker")
STREAM = "litix:fulfillment:queue"
GROUP = "litix-owned-node-router-v1"
CONSUMER = socket.gethostname()[:30]
CHANNEL_PREFIX = "litix:node:"
VALID_KINDS = ("creative_kit","post_monitoring","first_party_content_review")

async def observation_poller(db:asyncpg.Pool, stop:asyncio.Event) -> None:
    """Only promotes records attested by the owner or an authorized first-party agent."""
    while not stop.is_set():
        async with db.acquire() as con:
            async with con.transaction():
                observations=await con.fetch(
                    """SELECT o.id,o.agency_id,o.platform,o.handle,o.external_post_id,
                              o.content_url,o.owner_consent_ref,a.tier
                       FROM growth_ops.authorized_post_observations o
                       JOIN growth_ops.agency_retainers a ON a.id=o.agency_id
                       WHERE o.state='PENDING' AND a.subscription_status='ACTIVE'
                         AND a.consent_verified_at IS NOT NULL
                         AND a.quota_used<a.monthly_stream_quota
                         AND o.verified_source IN ('owner_authenticated','node_attested')
                         AND EXISTS(
                           SELECT 1 FROM jsonb_array_elements_text(a.monitored_handles) AS h(handle)
                           WHERE h.handle=o.handle
                         )
                       ORDER BY o.created_at FOR UPDATE OF o SKIP LOCKED LIMIT 30""")
                for obs in observations:
                    req={"platform":obs["platform"],"handle":obs["handle"],
                         "external_post_id":obs["external_post_id"],
                         "content_url":obs["content_url"],
                         "owner_consent_ref":obs["owner_consent_ref"],
                         "purpose":"authorized_post_monitoring"}
                    await con.execute(
                        """INSERT INTO growth_ops.direct_fulfillment_jobs
                           (agency_id,observation_id,service_kind,request)
                           VALUES($1,$2,'post_monitoring',$3::jsonb)
                           ON CONFLICT(observation_id) DO NOTHING""",
                        obs["agency_id"],obs["id"],json.dumps(req))
                    await con.execute(
                        "UPDATE growth_ops.authorized_post_observations SET state='QUEUED' WHERE id=$1",
                        obs["id"])
        try: await asyncio.wait_for(stop.wait(),60)
        except asyncio.TimeoutError: pass

async def outbox_publisher(db:asyncpg.Pool, redis:Redis, stop:asyncio.Event) -> None:
    """Durable DB outbox; Redis stream messages may repeat; job IDs dedupe on claims."""
    while not stop.is_set():
        async with db.acquire() as con:
            rows=await con.fetch(
                """SELECT id FROM growth_ops.direct_fulfillment_jobs
                   WHERE status='QUEUED' AND (published_at IS NULL OR published_at<NOW()-INTERVAL '90 seconds')
                   ORDER BY submitted_at LIMIT 30""")
            for item in rows:
                job_id=str(item["id"])
                await redis.xadd(STREAM,{"job_id":job_id},maxlen=100000,approximate=True)
                await con.execute(
                  """UPDATE growth_ops.direct_fulfillment_jobs
                     SET published_at=NOW() WHERE id=$1 AND status='QUEUED'""",item["id"])
        try: await asyncio.wait_for(stop.wait(),3)
        except asyncio.TimeoutError: pass

async def dispatch_to_node(db:asyncpg.Pool, redis:Redis, job_id:str) -> str:
    async with db.acquire() as con:
        async with con.transaction():
            job=await con.fetchrow(
               """SELECT id,service_kind,request,status,attempts
                  FROM growth_ops.direct_fulfillment_jobs
                  WHERE id=$1::uuid FOR UPDATE SKIP LOCKED""",job_id)
            if job is None:return "unknown_or_locked"
            if job["status"]!="QUEUED":return "already_claimed"
            if job["attempts"]>=10:
                await con.execute(
                  """UPDATE growth_ops.direct_fulfillment_jobs
                     SET status='REVIEW',last_error='max_delivery_attempts' WHERE id=$1""",job["id"])
                return "review"
            candidates=await con.fetch(
              """SELECT n.node_name,n.max_concurrency
                 FROM growth_ops.first_party_nodes n
                 JOIN growth_ops.first_party_node_keys k ON k.node_name=n.node_name
                 WHERE n.status='ONLINE' AND n.last_heartbeat>NOW()-INTERVAL '90 seconds'
                   AND k.enabled AND $1=ANY(k.authorized_services)
                 ORDER BY n.last_heartbeat DESC FOR UPDATE OF n SKIP LOCKED LIMIT 10""",
              job["service_kind"])
            for node in candidates:
                active=await con.fetchval(
                  """SELECT count(*) FROM growth_ops.direct_fulfillment_jobs
                     WHERE node_name=$1 AND status IN ('CLAIMED','ACKNOWLEDGED')""",
                  node["node_name"])
                if active>=node["max_concurrency"]:continue
                await con.execute(
                  """UPDATE growth_ops.direct_fulfillment_jobs
                     SET status='CLAIMED',node_name=$2,attempts=attempts+1,
                         lease_until=NOW()+INTERVAL '120 seconds',
                         accepted_at=NOW()
                     WHERE id=$1 AND status='QUEUED'""",job["id"],node["node_name"])
                # A signed node agent can fetch/ack this job even after Redis failover.
                await redis.xadd(CHANNEL_PREFIX+node["node_name"]+":jobs",
                    {"job_id":str(job["id"]),"kind":job["service_kind"]},
                    maxlen=25000,approximate=True)
                return "dispatched_to_first_party_node"
            return "no_healthy_authorized_node"

async def queue_consumer(db:asyncpg.Pool, redis:Redis, stop:asyncio.Event) -> None:
    try: await redis.xgroup_create(STREAM,GROUP,id="0-0",mkstream=True)
    except ResponseError as err:
        if "BUSYGROUP" not in str(err):raise
    while not stop.is_set():
        messages=await redis.xreadgroup(GROUP,CONSUMER,{STREAM:">"},count=10,block=5000)
        for _,items in messages:
            for msg_id,fields in items:
                try:
                    job_id=fields.get("job_id","")
                    if len(job_id)!=36:raise ValueError("invalid_job_id")
                    status=await dispatch_to_node(db,redis,job_id)
                    if status=="no_healthy_authorized_node":
                        # Keep work recoverable via the DB publisher instead of falsely accepting.
                        LOG.info("litix_direct_waiting_for_owned_node")
                    else:
                        LOG.info("litix_direct_dispatch_result=%s",status)
                    await redis.xack(STREAM,GROUP,msg_id)
                except Exception:
                    LOG.exception("direct_dispatch_retry_pending")
                    # Leave pending for Redis reclaim, never ACK unknown failures.

async def lease_reconciler(db:asyncpg.Pool, stop:asyncio.Event) -> None:
    while not stop.is_set():
        await db.execute(
          """UPDATE growth_ops.direct_fulfillment_jobs
             SET status=CASE WHEN attempts>=10 THEN 'REVIEW' ELSE 'QUEUED' END,
                 lease_until=NULL,node_name=NULL,
                 last_error='owned_node_receipt_timeout'
             WHERE status IN ('CLAIMED','ACKNOWLEDGED')
               AND lease_until<NOW() AND completed_at IS NULL""")
        try: await asyncio.wait_for(stop.wait(),15)
        except asyncio.TimeoutError: pass

async def main():
    if os.environ.get("LITIX_DIRECT_WORKER_ENABLED")!="true":
        raise RuntimeError("direct_worker_disabled")
    dsn=os.environ.get("DATABASE_URL","")
    url=os.environ.get("REDIS_URL","")
    if not dsn.startswith(("postgres://","postgresql://")) or not url.startswith("rediss://"):
        raise RuntimeError("direct_postgres_and_tls_redis_required")
    db=await asyncpg.create_pool(dsn,min_size=1,max_size=6,command_timeout=15)
    redis=Redis.from_url(url,decode_responses=True,socket_connect_timeout=5,socket_timeout=8)
    stop=asyncio.Event()
    try:
        await db.fetchval("SELECT 1")
        await redis.ping()
        LOG.info("LITIX_DIRECT_WORKER_READY first_party_only=true")
        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(observation_poller(db,stop))
            tasks.create_task(outbox_publisher(db,redis,stop))
            tasks.create_task(queue_consumer(db,redis,stop))
            tasks.create_task(lease_reconciler(db,stop))
    finally:
        stop.set()
        await redis.aclose()
        await db.close()

if __name__=="__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
