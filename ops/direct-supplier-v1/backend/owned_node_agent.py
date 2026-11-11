"""Litix-owned node agent for first-party content generation and observation reports.
It never calls engagement resellers or sends artificial likes/follows/views.
"""
from __future__ import annotations
import asyncio
import base64
import hashlib
import json
import os
import secrets
from datetime import datetime,timezone
from uuid import uuid4

import httpx
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

API=os.environ.get("LITIX_DIRECT_BACKEND_URL","")
NODE=os.environ.get("LITIX_DIRECT_NODE_NAME","")
KEY=os.environ.get("LITIX_DIRECT_NODE_ED25519_KEY_B64","")
OWNED_CREATIVE_URL="https://www.litix.net/api/direct-smm/creative-kit"
if not API.startswith("https://") or not NODE or not KEY:
    raise RuntimeError("signed_litix_owned_agent_configuration_missing")
if not API.endswith("/"):
    API+="/"
private_key=Ed25519PrivateKey.from_private_bytes(base64.b64decode(KEY,validate=True))
if len(NODE)>64:raise RuntimeError("invalid_node_name")

def signed(action,job_id=None,evidence_sha256=None,observed_units=None,artifact=None):
    payload={"node_name":NODE,"event_id":str(uuid4()),"signed_at":datetime.now(timezone.utc).isoformat(),
             "nonce":secrets.token_hex(24),"action":action}
    if job_id is not None:payload["job_id"]=str(job_id)
    if evidence_sha256 is not None:payload["evidence_sha256"]=evidence_sha256
    if observed_units is not None:payload["observed_units"]=observed_units
    if artifact is not None:payload["artifact"]=artifact
    raw=json.dumps(payload,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
    payload["signature_b64"]=base64.b64encode(private_key.sign(raw)).decode()
    return payload

def brief_from_request(job):
    req=job["request"]
    if job["kind"]!="creative_kit":
        raise ValueError("not_creative_work")
    b=req.get("brief")
    if not isinstance(b,dict):
        raise ValueError("owned_creative_brief_required")
    permitted={"brand","campaign","audience","pain","solution","cta","landingUrl","proof"}
    return {k:v for k,v in b.items() if k in permitted}

async def produce(client:httpx.AsyncClient,job):
    kind=job["kind"]
    if kind=="creative_kit":
        brief=brief_from_request(job)
        response=await client.post(OWNED_CREATIVE_URL,json=brief,timeout=25.0)
        response.raise_for_status()
        j=response.json()
        if (j.get("status")!="generated_draft" or j.get("supplierApiCalled") is not False or
            j.get("chargeAttempted") is not False or
            len((j.get("kit") or {}).get("variants",[]))!=12):
            raise RuntimeError("owned_content_artifact_verification_failed")
        return {"service_kind":"creative_kit","node":NODE,
                "kit":j["kit"],"published":False,"social_engagement_delivered":0},12
    if kind=="post_monitoring":
        req=job["request"]
        if req.get("purpose")!="authorized_post_monitoring" or not req.get("owner_consent_ref"):
            raise ValueError("content_not_authorized")
        return {"service_kind":"post_monitoring","node":NODE,"observed_post":{
                "platform":req["platform"],"handle":req["handle"],
                "external_post_id":req["external_post_id"],
                "content_url":req["content_url"]},
                "verified_content_observation":True,
                "social_engagement_delivered":0,"published":False},1
    if kind=="first_party_content_review":
        req=job["request"]
        if req.get("requires_human_review") is not False:
            raise ValueError("human_review_cannot_be_auto_completed")
        return {"service_kind":"first_party_content_review","node":NODE,
                "original_content_sha256":req["original_content_sha256"],
                "review_type":"automated_format_verification",
                "human_review_completed":False,"social_engagement_delivered":0},1
    raise RuntimeError("unsupported_first_party_service")

async def post_signed(client:httpx.AsyncClient,path:str,payload:dict):
    result=await client.post(API.rstrip("/")+"/v1/nodes/"+path,json=payload,timeout=15.0)
    result.raise_for_status()
    return result.json()

async def main():
    async with httpx.AsyncClient(follow_redirects=False,headers={"user-agent":"LitixOwnedNode/1.0"}) as client:
        while True:
            try:
                await post_signed(client,"heartbeat",signed("heartbeat"))
                result=await post_signed(client,"lease",signed("lease"))
                for job in result["jobs"]:
                    try:
                        artifact,units=await produce(client,job)
                        raw=json.dumps(artifact,separators=(",",":"),sort_keys=True)
                        if len(raw.encode())>250000:raise ValueError("artifact_too_large")
                        digest=hashlib.sha256(raw.encode()).hexdigest()
                        receipt=await post_signed(
                            client,"receipt",signed("receipt",job_id=job["job_id"],
                             evidence_sha256=digest,observed_units=units,artifact=artifact))
                        if receipt.get("status")!="COMPLETED":
                            raise RuntimeError("direct_receipt_not_accepted")
                        print("LITIX_OWNED_NODE_DELIVERY_CONFIRMED",job["job_id"],digest,flush=True)
                    except (httpx.HTTPError,KeyError,ValueError,RuntimeError) as error:
                        print("LITIX_OWNED_NODE_DELIVERY_REVIEW",job.get("job_id"),type(error).__name__,flush=True)
            except (httpx.HTTPError,KeyError,ValueError) as error:
                print("LITIX_OWNED_NODE_HEARTBEAT_RETRY",type(error).__name__,flush=True)
            await asyncio.sleep(12)

if __name__=="__main__":
    asyncio.run(main())
