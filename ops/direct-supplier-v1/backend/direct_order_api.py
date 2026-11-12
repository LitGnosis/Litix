"""Owned-only free creative order intake. No card charges or reseller calls."""
import hashlib
import hmac
import json
import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/v1/internal/direct", tags=["litix-owned-orders"])
REQUIRED = ("brand", "campaign", "audience", "pain", "solution", "cta", "landingUrl")


def internal(request: Request):
    secret = os.environ.get("LITIX_INTERNAL_SERVICE_TOKEN", "")
    if len(secret) < 32 or not hmac.compare_digest(
        request.headers.get("authorization", ""), "Bearer " + secret
    ):
        raise HTTPException(401, "internal_credential_required")


class DirectCreativeOrder(BaseModel):
    service_kind: str
    idempotency_key: str = Field(pattern=r"^[A-Za-z0-9_-]{16,128}$")
    brief: dict[str, str] = Field(min_length=7, max_length=7)

    @field_validator("service_kind")
    @classmethod
    def owned_service_only(cls, value):
        if value != "creative_kit":
            raise ValueError("unverified_first_party_kind")
        return value

    @field_validator("brief")
    @classmethod
    def full_brief(cls, value):
        if set(value) != set(REQUIRED):
            raise ValueError("exact_creative_brief_required")
        if any(not isinstance(v, str) or not 2 <= len(v.strip()) <= 500 for v in value.values()):
            raise ValueError("invalid_brief_fields")
        from urllib.parse import urlsplit
        landing = urlsplit(value["landingUrl"])
        if landing.scheme != "https" or not landing.hostname or landing.username or landing.password:
            raise ValueError("valid_https_landing_page_required")
        return value


@router.post("/orders", dependencies=[Depends(internal)])
async def submit_direct_order(request: Request, payload: DirectCreativeOrder):
    # The job ID is deterministic per internal-token/idempotency-key pair.
    # Thus a network retry can never enqueue two deliveries.
    secret = os.environ["LITIX_INTERNAL_SERVICE_TOKEN"]
    job_id = UUID(bytes=hmac.new(secret.encode(), payload.idempotency_key.encode(), hashlib.sha256).digest()[:16])
    brief_json = json.dumps(payload.brief, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(brief_json.encode()).hexdigest()
    job_request = {
        "brief": payload.brief,
        "request_digest": digest,
        "payment": "not_applicable",
        "consent": "owned_creative_draft",
    }

    async with request.app.state.db.acquire() as conn:
        async with conn.transaction():
            previous = await conn.fetchrow(
                "SELECT id, status, request FROM growth_ops.direct_fulfillment_jobs WHERE id=$1 FOR UPDATE",
                job_id,
            )
            if previous:
                if previous["service_kind"] != "creative_kit" or previous["request"].get("request_digest") != digest:
                    raise HTTPException(409, "idempotency_key_reused_with_different_order")
                return {"job_id": str(previous["id"]), "status": previous["status"], "replayed": True}

            service = await conn.fetchval(
                """SELECT 1 FROM growth_ops.direct_service_catalog
                   WHERE service_kind='creative_kit' AND available AND first_party_only"""
            )
            if not service:
                raise HTTPException(503, "litix_creative_service_unavailable")
            nodes = await conn.fetchval(
                """SELECT count(*) FROM growth_ops.first_party_nodes n
                   JOIN growth_ops.first_party_node_keys k ON k.node_name=n.node_name
                   WHERE n.status='ONLINE' AND n.last_heartbeat>NOW()-INTERVAL '90 seconds'
                     AND k.enabled AND 'creative_kit'=ANY(k.authorized_services)"""
            )
            if not nodes:
                raise HTTPException(503, "no_verified_first_party_node")
            await conn.execute(
                """INSERT INTO growth_ops.direct_fulfillment_jobs
                   (id,service_kind,request,status)
                   VALUES($1,'creative_kit',$2::jsonb,'QUEUED')""",
                job_id, json.dumps(job_request),
            )
    # The Railway worker's durable outbox publishes this record to TLS Redis.
    return {"job_id": str(job_id), "status": "QUEUED", "replayed": False}
