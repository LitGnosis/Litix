"""Signed, allowlisted downstream delivery status broadcaster.

Not a public callback registration API. Prevent SSRF with exact operator domain
allowlists, public-IP pre-check and a mandatory network egress firewall.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import ipaddress
import json
import logging
import os
import socket
from typing import Any
from urllib.parse import urlsplit

from .models import webhook_body, webhook_signature

log=logging.getLogger("litix.first_party.webhooks")

def load_endpoints(raw: str, allowed: str) -> dict[str,dict[str,str]]:
    config: Any=json.loads(raw)
    hosts={h.strip().lower() for h in allowed.split(",") if h.strip()}
    if not isinstance(config,dict) or not hosts:
        raise ValueError("no_approved_webhook_hosts")
    valid={}
    for key,item in config.items():
        if not isinstance(key,str) or not key or len(key)>64 or not isinstance(item,dict):
            raise ValueError("invalid_destination_record")
        url=item.get("url")
        secret=item.get("secret")
        if not isinstance(url,str) or not isinstance(secret,str) or len(secret.encode())<32:
            raise ValueError("invalid_webhook_credentials")
        try:
            parsed=urlsplit(url)
            port=parsed.port
        except ValueError as exc:
            raise ValueError("invalid_url_port") from exc
        if (parsed.scheme!="https" or not parsed.hostname or
            parsed.hostname.lower() not in hosts or
            parsed.username or parsed.password or port not in (None,443) or
            parsed.fragment or not parsed.path.startswith("/")):
            raise ValueError("webhook_destination_not_approved")
        valid[key]={"url":url,"secret":secret,"host":parsed.hostname}
    return valid

async def public_dns_only(host: str) -> bool:
    if host.lower() in ("localhost","localhost.localdomain") or host.endswith(".local"):
        return False
    try:
        answers=await asyncio.get_running_loop().getaddrinfo(host,443,type=socket.SOCK_STREAM)
        return bool(answers) and all(ipaddress.ip_address(row[4][0]).is_global for row in answers)
    except (OSError,ValueError):
        return False

async def claim_due(db: Any, count: int=12) -> list[Any]:
    async with db.acquire() as c:
        return await c.fetch(
            """WITH due AS (
                 SELECT id FROM growth_ops.litix_owned_delivery_webhook_outbox
                 WHERE ((state IN ('pending','retry') AND next_attempt_at<=now())
                     OR (state='sending' AND lease_until<now()))
                   AND attempts<8
                 ORDER BY next_attempt_at,id
                 FOR UPDATE SKIP LOCKED LIMIT $1
               )
               UPDATE growth_ops.litix_owned_delivery_webhook_outbox o
               SET state='sending',lease_token=gen_random_uuid(),
                   lease_until=now()+interval '30 seconds',attempts=o.attempts+1
               FROM due WHERE o.id=due.id
               RETURNING o.id,o.lease_token,o.event_id,o.endpoint_key,o.payload,o.attempts""",count)

async def dispatch_one(client: Any, db: Any, row: Any, endpoints:dict[str,dict[str,str]]) -> str:
    endpoint=endpoints.get(row["endpoint_key"])
    http_code=0
    reason="destination_missing"
    sent=False
    if endpoint and await public_dns_only(endpoint["host"]):
        import httpx
        event_id=str(row["event_id"])
        data=row["payload"]
        body=webhook_body(data)
        ts=int(datetime.now(timezone.utc).timestamp())
        headers={
            "Content-Type":"application/json",
            "User-Agent":"Litix-First-Party-Status/1.0",
            "X-Litix-Event-Id":event_id,
            "X-Litix-Timestamp":str(ts),
            "X-Litix-Signature":"sha256="+webhook_signature(data,event_id,ts,endpoint["secret"]),
            "Idempotency-Key":event_id,
        }
        try:
            res=await client.post(endpoint["url"],headers=headers,content=body)
            http_code=res.status_code
            sent=200<=http_code<300
            reason=f"http_{http_code}"
        except (httpx.RequestError,TimeoutError):
            reason="transport_error"
    elif endpoint:
        reason="destination_not_public"
    terminal=(reason in ("destination_missing","destination_not_public") or
              (400<=http_code<500 and http_code not in (408,429)) or
              row["attempts"]>=8)
    state="sent" if sent else "dead" if terminal else "retry"
    delay=min(3600,10*2**min(int(row["attempts"]),8))
    async with db.acquire() as c:
        await c.execute(
            """UPDATE growth_ops.litix_owned_delivery_webhook_outbox
               SET state=$3,lease_token=NULL,lease_until=NULL,
                   next_attempt_at=CASE WHEN $3='retry'
                       THEN now()+($4::int*interval '1 second') ELSE next_attempt_at END,
                   sent_at=CASE WHEN $3='sent' THEN now() ELSE sent_at END,
                   last_error_code=CASE WHEN $3='sent' THEN NULL ELSE $5 END
               WHERE id=$1 AND lease_token=$2 AND state='sending'""",
            row["id"],row["lease_token"],state,delay,reason)
    log.info("litix_webhook state=%s event=%s",state,row["event_id"])
    return state

async def run() -> None:
    import asyncpg
    import httpx
    if os.getenv("LITIX_OWNED_WEBHOOKS_ENABLED")!="true":
        raise RuntimeError("webhook_dispatch_disabled")
    database=os.getenv("DATABASE_URL","")
    if not database:
        raise RuntimeError("database_not_configured")
    endpoints=load_endpoints(os.getenv("LITIX_WEBHOOK_ENDPOINT_CONFIG_JSON","{}"),
                             os.getenv("LITIX_WEBHOOK_ALLOWED_HOSTS",""))
    pool=await asyncpg.create_pool(dsn=database,min_size=1,max_size=8,command_timeout=10)
    async with httpx.AsyncClient(timeout=5,trust_env=False,follow_redirects=False,
                                 limits=httpx.Limits(max_connections=16,max_keepalive_connections=8)) as client:
        try:
            while True:
                rows=await claim_due(pool)
                if rows:
                    await asyncio.gather(*(dispatch_one(client,pool,row,endpoints) for row in rows))
                else:
                    await asyncio.sleep(2)
        finally:
            await pool.close()

if __name__=="__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
