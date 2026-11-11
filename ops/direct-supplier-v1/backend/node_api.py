"""Signed first-party node control plane and authorized-content observations."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from uuid import UUID

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field

router=APIRouter(prefix="/v1",tags=["first-party-nodes"])
NODE_NAME=re.compile(r"^[a-z][a-z0-9-]{2,63}$")
SERVICES={"creative_kit","post_monitoring","first_party_content_review"}

def trusted_backend(request:Request):
    import hmac
    secret=os.environ.get("LITIX_INTERNAL_SERVICE_TOKEN","")
    if len(secret)<32 or not hmac.compare_digest(request.headers.get("authorization",""),"Bearer "+secret):
        raise HTTPException(401,"backend_auth_required")

class RegisterNode(BaseModel):
    node_name:str=Field(min_length=3,max_length=64)
    ed25519_public_key_b64:str=Field(min_length=43,max_length=64)
    authorized_services:list[str]=Field(min_length=1,max_length=3)
    max_concurrency:int=Field(ge=1,le=32)

class SignedNodeMessage(BaseModel):
    node_name:str
    event_id:UUID
    signed_at:datetime
    nonce:str=Field(min_length=48,max_length=48)
    action:str
    job_id:UUID|None=None
    evidence_sha256:str|None=None
    observed_units:int|None=Field(default=None,ge=0,le=1000000)
    artifact:dict|None=None
    signature_b64:str

def canonical(payload:SignedNodeMessage)->bytes:
    data=payload.model_dump(mode="json",exclude={"signature_b64"},exclude_none=True)
    return json.dumps(data,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()

async def verified_node(request:Request,payload:SignedNodeMessage,expected_action:str):
    if payload.action!=expected_action or not NODE_NAME.fullmatch(payload.node_name):
        raise HTTPException(422,"invalid_node_message")
    if payload.signed_at.tzinfo is None or abs((datetime.now(timezone.utc)-payload.signed_at).total_seconds())>300:
        raise HTTPException(401,"expired_node_signature")
    if not re.fullmatch(r"[a-f0-9]{48}",payload.nonce):
        raise HTTPException(401,"invalid_nonce")
    con=request.app.state.db
    key=await con.fetchrow(
      """SELECT k.ed25519_public_key_b64
         FROM growth_ops.first_party_node_keys k
         JOIN growth_ops.first_party_nodes n ON n.node_name=k.node_name
         WHERE k.node_name=$1 AND k.enabled
           AND n.status IN ('ONLINE','REGISTERED')""",payload.node_name)
    if not key:
        raise HTTPException(403,"node_not_authorized")
    try:
        public=Ed25519PublicKey.from_public_bytes(base64.b64decode(key["ed25519_public_key_b64"],validate=True))
        public.verify(base64.b64decode(payload.signature_b64,validate=True),canonical(payload))
    except (InvalidSignature,ValueError,TypeError):
        raise HTTPException(401,"invalid_node_signature")
    # Replay protection must be committed ahead of work; retries use a fresh signed event.
    inserted=await con.fetchval(
      """INSERT INTO growth_ops.direct_node_nonces(node_name,nonce)
         VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING nonce""",
      payload.node_name,payload.nonce)
    if not inserted:
        raise HTTPException(409,"replayed_node_nonce")

@router.post("/nodes/register",dependencies=[Depends(trusted_backend)])
async def register_node(request:Request,data:RegisterNode):
    if (not NODE_NAME.fullmatch(data.node_name) or
        len(set(data.authorized_services))!=len(data.authorized_services) or
        any(s not in SERVICES for s in data.authorized_services)):
        raise HTTPException(422,"invalid_node_permissions")
    try:
        if len(base64.b64decode(data.ed25519_public_key_b64,validate=True))!=32:
            raise ValueError("not_ed25519")
    except ValueError:
        raise HTTPException(422,"invalid_public_key")
    async with request.app.state.db.acquire() as con:
        async with con.transaction():
            reg=await con.fetchval(
              """SELECT 1 FROM growth_ops.first_party_nodes
                 WHERE node_name=$1 AND node_type='FIRST_PARTY_COMPUTE' FOR UPDATE""",
              data.node_name)
            if not reg:
                raise HTTPException(404,"node_registry_record_required")
            await con.execute(
              """INSERT INTO growth_ops.first_party_node_keys
                 (node_name,ed25519_public_key_b64,authorized_services,enabled)
                 VALUES($1,$2,$3,FALSE)
                 ON CONFLICT(node_name) DO UPDATE SET
                    ed25519_public_key_b64=EXCLUDED.ed25519_public_key_b64,
                    authorized_services=EXCLUDED.authorized_services,
                    enabled=FALSE,updated_at=NOW()""",
              data.node_name,data.ed25519_public_key_b64,data.authorized_services)
            await con.execute(
              """UPDATE growth_ops.first_party_nodes
                 SET status='REGISTERED',max_concurrency=$2,last_heartbeat=NULL
                 WHERE node_name=$1""",data.node_name,data.max_concurrency)
    return {"node":data.node_name,"status":"REGISTERED","enabled":False,
            "activation":"requires_owner_review_of_physical_node_and_signature"}

@router.post("/nodes/heartbeat")
async def heartbeat(request:Request,payload:SignedNodeMessage):
    await verified_node(request,payload,"heartbeat")
    result=await request.app.state.db.fetchval(
      """UPDATE growth_ops.first_party_nodes n SET status='ONLINE',last_heartbeat=NOW(),updated_at=NOW()
         WHERE n.node_name=$1 AND EXISTS
         (SELECT 1 FROM growth_ops.first_party_node_keys k WHERE k.node_name=n.node_name AND k.enabled)
         RETURNING n.node_name""",payload.node_name)
    if not result:raise HTTPException(403,"node_not_enabled")
    return {"node":result,"heartbeat":"verified","delivery_claims":0}

@router.post("/nodes/lease")
async def lease(request:Request,payload:SignedNodeMessage):
    await verified_node(request,payload,"lease")
    entries=await request.app.state.db.fetch(
      """SELECT j.id,j.service_kind,j.request,j.lease_until
         FROM growth_ops.direct_fulfillment_jobs j
         JOIN growth_ops.first_party_node_keys n ON n.node_name=j.node_name
         WHERE j.node_name=$1 AND j.status='CLAIMED'
           AND j.lease_until>NOW() AND n.enabled
           AND j.service_kind=ANY(n.authorized_services)
         ORDER BY j.accepted_at LIMIT 20""",payload.node_name)
    return {"node":payload.node_name,
            "jobs":[{"job_id":str(v["id"]),"kind":v["service_kind"],"request":v["request"],
                     "expires_at":v["lease_until"].isoformat()} for v in entries]}

@router.post("/nodes/receipt")
async def receipt(request:Request,payload:SignedNodeMessage):
    if not payload.job_id or not payload.evidence_sha256 or payload.artifact is None or payload.observed_units is None:
        raise HTTPException(422,"node_delivery_evidence_required")
    artifact=json.dumps(payload.artifact,separators=(",",":"),sort_keys=True)
    if len(artifact.encode())>250000:
        raise HTTPException(413,"node_artifact_too_large")
    if hashlib.sha256(artifact.encode()).hexdigest()!=payload.evidence_sha256:
        raise HTTPException(422,"artifact_digest_mismatch")
    await verified_node(request,payload,"receipt")
    async with request.app.state.db.acquire() as con:
        async with con.transaction():
            job=await con.fetchrow(
              """SELECT j.id,j.status,j.service_kind,j.node_name,j.lease_until,j.agency_id
                 FROM growth_ops.direct_fulfillment_jobs j
                 WHERE j.id=$1 FOR UPDATE""",payload.job_id)
            if not job or job["node_name"]!=payload.node_name or job["status"]!="CLAIMED" or job["lease_until"]<datetime.now(timezone.utc):
                raise HTTPException(409,"job_not_currently_leased_to_node")
            if job["service_kind"] not in SERVICES:
                raise HTTPException(403,"unsupported_delivery_kind")
            if payload.artifact.get("service_kind")!=job["service_kind"]:
                raise HTTPException(422,"artifact_service_mismatch")
            # This is a count of independently evidenced creative/monitoring outputs, never social likes/views.
            if payload.observed_units>12:
                raise HTTPException(422,"output_evidence_count_exceeds_first_party_limit")
            await con.execute(
              """INSERT INTO growth_ops.direct_node_receipts
                 (event_id,job_id,node_name,evidence_sha256,observed_units,signed_at,signature_b64)
                 VALUES($1,$2,$3,$4,$5,$6,$7)""",payload.event_id,payload.job_id,payload.node_name,
              payload.evidence_sha256,payload.observed_units,payload.signed_at,payload.signature_b64)
            await con.execute(
              """INSERT INTO growth_ops.direct_job_artifacts(job_id,content,sha256)
                 VALUES($1,$2,$3)""",payload.job_id,artifact,payload.evidence_sha256)
            await con.execute(
              """UPDATE growth_ops.direct_fulfillment_jobs
                 SET status='COMPLETED',completed_at=NOW(),lease_until=NULL
                 WHERE id=$1""",payload.job_id)
            if job["agency_id"]:
                await con.execute(
                  """UPDATE growth_ops.agency_retainers
                     SET quota_used=quota_used+1,updated_at=NOW()
                     WHERE id=$1 AND quota_used<monthly_stream_quota""",job["agency_id"])
    return {"status":"COMPLETED","job_id":str(payload.job_id),
            "evidence_sha256":payload.evidence_sha256,
            "claimed_social_interactions":0}

class Observation(BaseModel):
    agency_id:UUID
    platform:str
    handle:str
    external_post_id:str=Field(min_length=4,max_length=250)
    content_url:str=Field(min_length=12,max_length=1000)
    observed_at:datetime
    owner_consent_ref:str=Field(min_length=8,max_length=200)

@router.post("/observations",dependencies=[Depends(trusted_backend)])
async def authorized_observation(request:Request,body:Observation):
    if body.platform not in {"instagram","tiktok","youtube","x","linkedin"} or not body.handle.startswith("@"):
        raise HTTPException(422,"unsupported_platform_or_handle")
    if body.observed_at.tzinfo is None or body.observed_at>datetime.now(timezone.utc):
        raise HTTPException(422,"invalid_observation_time")
    from urllib.parse import urlsplit
    url=urlsplit(body.content_url)
    if url.scheme!="https" or url.username or url.password or not url.hostname:
        raise HTTPException(422,"valid_https_public_post_required")
    async with request.app.state.db.acquire() as con:
        agency=await con.fetchrow(
          """SELECT monitored_handles,subscription_status,consent_verified_at
             FROM growth_ops.agency_retainers WHERE id=$1""",body.agency_id)
        if not agency or agency["subscription_status"]!="ACTIVE" or not agency["consent_verified_at"]:
            raise HTTPException(403,"agency_monitoring_not_authorized")
        if body.handle not in agency["monitored_handles"]:
            raise HTTPException(403,"handle_not_in_verified_agency_scope")
        r=await con.fetchval(
          """INSERT INTO growth_ops.authorized_post_observations
             (agency_id,platform,handle,external_post_id,content_url,observed_at,owner_consent_ref,verified_source)
             VALUES($1,$2,$3,$4,$5,$6,$7,'owner_authenticated')
             ON CONFLICT(platform,external_post_id,agency_id) DO UPDATE
             SET external_post_id=EXCLUDED.external_post_id
             RETURNING id""",
          body.agency_id,body.platform,body.handle,body.external_post_id,
          body.content_url,body.observed_at,body.owner_consent_ref)
    return {"observation_id":str(r),"state":"PENDING","auto_interactions_dispatched":False}
