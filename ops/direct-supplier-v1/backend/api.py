"""Litix-owned wholesale and agency control plane. No reseller purchasing APIs."""
from __future__ import annotations

import base64
import hashlib
import hmac
import httpx
import json
import os
import re
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

import asyncpg
import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import FastAPI, HTTPException, Request, Depends
from pydantic import BaseModel, Field, field_validator
from redis.asyncio import Redis

from nmi import cents, verify_signature, query_completed_transaction, NmiVerificationError
from node_api import router as node_router

PRICES = {"PANEL_149_WK":14900, "AGENCY_500_WK":50000, "ENTERPRISE_1500_WK":150000}
MAX_HANDLES = {"AGENCY_500_WK":25, "ENTERPRISE_1500_WK":100}
NO_RESELLER_BACKENDS = True
EMAIL = re.compile(r"^[^\s@]{1,64}@[^\s@]{2,190}\.[A-Za-z]{2,24}$")
DOMAIN = re.compile(r"^[a-z0-9](?:[a-z0-9.-]{2,251})[a-z0-9]$")
HANDLE = re.compile(r"^@[A-Za-z0-9._-]{1,60}$")

@asynccontextmanager
async def lifespan(app: FastAPI):
    dsn = os.environ.get("DATABASE_URL","")
    redis_url = os.environ.get("REDIS_URL","")
    if not dsn.startswith(("postgres://","postgresql://")) or not redis_url.startswith("rediss://"):
        raise RuntimeError("Litix requires Postgres and authenticated TLS Redis")
    app.state.db = await asyncpg.create_pool(dsn, min_size=1, max_size=8, command_timeout=15)
    app.state.redis = Redis.from_url(redis_url, decode_responses=True,
                                     socket_connect_timeout=5, socket_timeout=8)
    await app.state.redis.ping()
    yield
    await app.state.redis.aclose()
    await app.state.db.close()

app = FastAPI(title="Litix Direct Supplier API", version="1.0", lifespan=lifespan,
              openapi_url=None if os.environ.get("LITIX_DIRECT_EXPOSE_DOCS")!="true" else "/openapi.json")

def internal(request: Request):
    token = os.environ.get("LITIX_INTERNAL_SERVICE_TOKEN","")
    supplied = request.headers.get("authorization","")
    if len(token) < 32 or not hmac.compare_digest(supplied,"Bearer "+token):
        raise HTTPException(status_code=401, detail="internal_credential_required")

async def limit(request:Request, name:str, threshold:int=12):
    peer=request.client.host if request.client else "unknown"
    digest=hashlib.sha256(peer.encode()).hexdigest()[:24]
    key=f"litix:rate:{name}:{digest}"
    used=await request.app.state.redis.incr(key)
    if used==1:
        await request.app.state.redis.expire(key,60)
    if used>threshold:
        raise HTTPException(429,"rate_limited")

class Application(BaseModel):
    tier: str
    owner_email: str = Field(min_length=5,max_length=254)
    agency_name: str | None = Field(default=None,max_length=160)
    custom_domain: str | None = Field(default=None,max_length=254)
    referred_by: str | None = Field(default=None,max_length=64)

    @field_validator("owner_email")
    @classmethod
    def validate_email(cls,v):
        v=v.lower().strip()
        if not EMAIL.fullmatch(v):
            raise ValueError("valid_email_required")
        return v

    @field_validator("tier")
    @classmethod
    def validate_tier(cls,v):
        if v not in PRICES:
            raise ValueError("unsupported_tier")
        return v

    @field_validator("custom_domain")
    @classmethod
    def validate_domain(cls,v):
        if v is None: return v
        v=v.lower().strip()
        if not DOMAIN.fullmatch(v) or ".." in v or v.endswith(".local"):
            raise ValueError("valid_public_domain_required")
        return v

class HandleUpdate(BaseModel):
    handles: list[str] = Field(max_length=100)
    consent_reference: str = Field(min_length=8,max_length=200)

    @field_validator("handles")
    @classmethod
    def validate_handles(cls,hs):
        if len(hs)!=len(set(hs)) or any(not HANDLE.fullmatch(h) for h in hs):
            raise ValueError("unique_handles_required")
        return hs

def require_release(g):
    return bool(g and g["merchant_settlement_verified"] and
       g["fulfillment_capacity_verified"] and g["recurring_checkout_enabled"])

app.include_router(node_router)

@app.get("/healthz")
async def health(request:Request):
    await request.app.state.db.fetchval("SELECT 1")
    await request.app.state.redis.ping()
    gate=await request.app.state.db.fetchrow("SELECT * FROM growth_ops.direct_release_gates WHERE id=true")
    return {"api":"litix-direct","database":"ok","tls_redis":"ok",
            "reseller_api_calls":0,"recurring_checkout_enabled":require_release(gate)}

@app.get("/v1/plans")
async def plans(request:Request):
    gate=await request.app.state.db.fetchrow("SELECT * FROM growth_ops.direct_release_gates WHERE id=true")
    return {"currency":"USD","billing_period":"week","prices_cents":PRICES,
            "handle_limits":MAX_HANDLES,"checkout_enabled":require_release(gate),
            "fulfillment":"first_party_only","rates_are_revenue_goals":False}

@app.post("/v1/applications",dependencies=[Depends(internal)])
async def apply(request:Request, a:Application):
    await limit(request,"application")
    if a.tier=="PANEL_149_WK" and not a.custom_domain:
        raise HTTPException(422,"custom_domain_required")
    if a.tier!="PANEL_149_WK" and not a.agency_name:
        raise HTTPException(422,"agency_name_required")
    r=await request.app.state.db.fetchrow(
      """INSERT INTO growth_ops.revenue_applications(owner_email,agency_name,custom_domain,tier,referred_by)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(owner_email,tier) DO UPDATE SET
           agency_name=EXCLUDED.agency_name,custom_domain=EXCLUDED.custom_domain
         WHERE growth_ops.revenue_applications.status='PENDING'
         RETURNING id,status""",
      a.owner_email,a.agency_name,a.custom_domain,a.tier,a.referred_by)
    if not r:
        raise HTTPException(409,"application_already_processed")
    return {"application_id":str(r["id"]),"status":r["status"],
            "price_cents_weekly":PRICES[a.tier],"payment_initiated":False}

@app.post("/v1/checkout/readiness",dependencies=[Depends(internal)])
async def readiness(request:Request):
    gates=await request.app.state.db.fetchrow("SELECT * FROM growth_ops.direct_release_gates WHERE id=TRUE")
    if not require_release(gates):
        raise HTTPException(503,"merchant_and_fulfillment_release_not_verified")
    return {"ready":True,"merchant_checkout":"NMI tokenized recurring plan checkout requires approved recurring plan ID"}

@app.post("/v1/webhooks/nmi")
async def nmi_webhook(request:Request):
    raw=await request.body()
    if len(raw)>65536:
        raise HTTPException(413,"request_too_large")
    secret=os.environ.get("LITIX_NMI_WEBHOOK_SIGNING_KEY","")
    if not verify_signature(raw,request.headers.get("webhook-signature",""),secret):
        raise HTTPException(401,"invalid_signature")
    try:
        event=json.loads(raw)
    except (ValueError,UnicodeDecodeError):
        raise HTTPException(400,"invalid_event")
    event_id=str(event.get("event_id",""))
    event_type=str(event.get("event_type",""))
    details=event.get("event_body") or {}
    if not isinstance(details,dict) or len(event_id)<8 or len(event_id)>120:
        raise HTTPException(422,"invalid_event_fields")
    merchant=(details.get("merchant") or {}).get("id")
    if str(merchant)!=os.environ.get("LITIX_NMI_MERCHANT_ID",""):
        raise HTTPException(403,"merchant_mismatch")
    live=not bool((details.get("features") or {}).get("is_test_mode"))
    if os.environ.get("LITIX_NMI_TEST_MODE")!="true" and not live:
        raise HTTPException(403,"test_event_forbidden")
    # NMI has recurring.subscription.add/update/delete; no recurring.subscription.success.
    if event_type not in ("recurring.subscription.add","recurring.subscription.update",
                          "recurring.subscription.delete","transaction.sale.success",
                          "transaction.refund.success","settlement.batch.complete"):
        return {"accepted":True,"action":"ignored"}
    event_body=details
    transaction_id=str(event_body.get("transaction_id") or "")
    subscription_id=str(event_body.get("subscription_id") or "")
    order_id=str(event_body.get("order_id") or "")
    if event_type.startswith("transaction.") and (not transaction_id or not order_id):
        return {"accepted":True,"action":"review_identifiers"}
    if event_type.startswith("recurring.") and not subscription_id:
        return {"accepted":True,"action":"review_subscription"}
    checksum=hashlib.sha256(raw).hexdigest()
    try:
        application_id=UUID(order_id) if order_id else None
    except ValueError:
        application_id=None
    async with request.app.state.db.acquire() as con:
        async with con.transaction():
            existing=await con.fetchval("SELECT 1 FROM growth_ops.recurring_payment_events WHERE provider='nmi' AND event_id=$1",event_id)
            if existing:
                return {"accepted":True,"action":"duplicate"}
            await con.execute(
              """INSERT INTO growth_ops.recurring_payment_events
                 (provider,event_id,event_type,transaction_id,subscription_id,payload_sha256,
                  state,owner_email,tier,amount_cents,application_id)
                 VALUES('nmi',$1,$2,$3,$4,$5,'AWAITING_VERIFIED_SETTLEMENT',$6,$7,$8,$9)""",
              event_id,event_type,transaction_id or ("subscription:"+subscription_id),
              subscription_id or ("sale:"+transaction_id),checksum,None,None,
              cents(str((details.get("action") or {}).get("amount","0")))
              if event_type=="transaction.sale.success" else None,application_id)
    # Signed webhooks are notices. Funds require an independent NMI Query API result.
    return {"accepted":True,"action":"awaiting_independent_settlement"}

def wrap_key(key:str)->bytes:
    encryption_key=base64.b64decode(os.environ.get("LITIX_API_KEY_WRAP_KEY_B64",""))
    if len(encryption_key)!=32: raise RuntimeError("credential_vault_key_not_configured")
    nonce=secrets.token_bytes(12)
    return nonce+AESGCM(encryption_key).encrypt(nonce,key.encode(),b"litix-direct-panel")

async def reconcile_one(con, application, tx):
    tier=application["tier"]
    charge=PRICES[tier]
    verified=await query_completed_transaction(tx["transaction_id"],str(application["id"]),charge)
    await con.execute(
       """INSERT INTO growth_ops.verified_recurring_settlements
          (transaction_id,provider,subscription_id,amount_cents,currency,settlement_reference,verified_by)
          VALUES($1,'nmi',$2,$3,'USD',$4,'nmi-query-api')
          ON CONFLICT(transaction_id) DO NOTHING""",
       verified["transaction_id"],tx["subscription_id"],charge,verified["settlement_ref"])
    if tier=="PANEL_149_WK":
        key="lx_live_"+secrets.token_urlsafe(36)
        encrypted=wrap_key(key)
        digest=hashlib.sha256(key.encode()).hexdigest()
        panel=await con.fetchrow(
          """INSERT INTO growth_ops.child_panels
             (owner_email,custom_domain,api_key_hash,subscription_status,nmi_subscription_id)
             VALUES($1,$2,$3,'ACTIVE',$4)
             ON CONFLICT(custom_domain) DO NOTHING RETURNING id""",
          application["owner_email"],application["custom_domain"],digest,tx["subscription_id"])
        if not panel:
            raise RuntimeError('panel_provisioning_conflict_requires_review')
        if panel:
            await con.execute(
              """INSERT INTO growth_ops.panel_credential_delivery(panel_id,encrypted_key)
                 VALUES($1,$2) ON CONFLICT(panel_id) DO NOTHING""",panel["id"],encrypted)
    else:
        await con.execute(
          """INSERT INTO growth_ops.agency_retainers
             (agency_name,owner_email,tier,monitored_handles,subscription_status,nmi_subscription_id,monthly_stream_quota)
             VALUES($1,$2,$3,'[]'::jsonb,'ACTIVE',$4,$5)
             ON CONFLICT(nmi_subscription_id) DO NOTHING""",
          application["agency_name"],application["owner_email"],tier,tx["subscription_id"],
          100 if tier=='AGENCY_500_WK' else 400)
    if application["referred_by"]:
        await con.execute(
          """INSERT INTO growth_ops.affiliate_ledger
             (referrer_code,referred_account_id,source_payment_id,commission_usd,payout_status)
             VALUES($1,$2,$3,$4,'PENDING')
             ON CONFLICT(referred_account_id,source_payment_id) DO NOTHING""",
          application["referred_by"],application["id"],verified["transaction_id"],
          Decimal(charge)/Decimal(500))
    await con.execute("UPDATE growth_ops.revenue_applications SET status='CONVERTED' WHERE id=$1",application["id"])
    await con.execute("""UPDATE growth_ops.recurring_payment_events
         SET state='ACTIVATED',processed_at=NOW() WHERE provider='nmi'
         AND transaction_id=$1 AND state='AWAITING_VERIFIED_SETTLEMENT'""",tx["transaction_id"])

@app.post("/v1/internal/reconcile",dependencies=[Depends(internal)])
async def reconcile(request:Request):
    # Query API performs read-only merchant lookup. Reconciliation never submits a charge.
    async with request.app.state.db.acquire() as con:
        pending=await con.fetch(
          """SELECT e.transaction_id,e.subscription_id,e.amount_cents,a.*
             FROM growth_ops.recurring_payment_events e
             JOIN growth_ops.revenue_applications a ON a.id=e.application_id
             WHERE e.provider='nmi' AND e.event_type='transaction.sale.success'
               AND e.state='AWAITING_VERIFIED_SETTLEMENT'
               AND e.created_at>NOW()-INTERVAL '30 days'
             ORDER BY e.created_at LIMIT 20""")
    outcomes=[]
    for tx in pending:
        try:
            async with request.app.state.db.acquire() as con:
                async with con.transaction():
                    application=await con.fetchrow("SELECT * FROM growth_ops.revenue_applications WHERE id=$1 FOR UPDATE",tx["id"])
                    # Match the subscription notice with the same application ID.
                    sub=await con.fetchval("""SELECT subscription_id FROM growth_ops.recurring_payment_events
                        WHERE application_id=$1 AND event_type IN ('recurring.subscription.add','recurring.subscription.update')
                        ORDER BY created_at DESC LIMIT 1""",application["id"])
                    if not sub:
                        outcomes.append('subscription_event_missing');continue
                    tx=dict(tx);tx['subscription_id']=sub
                    if application["status"]=="CONVERTED":
                        outcomes.append("already_active");continue
                    if tx["amount_cents"]!=PRICES[application["tier"]]:
                        outcomes.append("amount_mismatch");continue
                    gate=await con.fetchrow("SELECT * FROM growth_ops.direct_release_gates WHERE id=true")
                    if not require_release(gate):
                        outcomes.append("release_gate_closed");continue
                    await reconcile_one(con,application,tx)
                    outcomes.append("reconciled")
        except (NmiVerificationError,ValueError,RuntimeError,httpx.HTTPError) as exc:
            outcomes.append(type(exc).__name__)
    return {"examined":len(pending),"results":outcomes,"external_supplier_orders":0}

@app.put("/v1/agencies/{agency_id}/handles",dependencies=[Depends(internal)])
async def handles(request:Request,agency_id:UUID,body:HandleUpdate):
    await limit(request,"agency_handles")
    async with request.app.state.db.acquire() as con:
        async with con.transaction():
            r=await con.fetchrow(
              """SELECT tier FROM growth_ops.agency_retainers
                 WHERE id=$1 AND subscription_status='ACTIVE' FOR UPDATE""",agency_id)
            if not r:
                raise HTTPException(404,"agency_not_active")
            if len(body.handles)>MAX_HANDLES[r["tier"]]:
                raise HTTPException(422,"tier_handle_limit")
            await con.execute(
              """UPDATE growth_ops.agency_retainers
                 SET monitored_handles=$2::jsonb,consent_verified_at=NOW(),updated_at=NOW()
                 WHERE id=$1""",agency_id,json.dumps(body.handles))
    return {"agency_id":str(agency_id),"handles_registered":len(body.handles),
            "automated_engagement_activated":False,"owner_consent_reference":body.consent_reference}

@app.get("/v1/panels/{panel_id}/api-key",dependencies=[])
async def retrieve_credential(request:Request,panel_id:UUID):
    # Only an owner with a verified Auth0 access token can retrieve the key once.
    authorization=request.headers.get("authorization","")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401,"owner_login_required")
    issuer=os.environ.get("LITIX_AUTH0_ISSUER","")
    audience=os.environ.get("LITIX_AUTH0_AUDIENCE","")
    if not issuer.startswith("https://") or not audience:
        raise HTTPException(503,"identity_provider_not_configured")
    try:
        jwks=jwt.PyJWKClient(issuer.rstrip("/")+"/.well-known/jwks.json")
        token=authorization[7:]
        signing=jwks.get_signing_key_from_jwt(token)
        identity=jwt.decode(token,signing.key,algorithms=["RS256"],audience=audience,issuer=issuer)
    except (jwt.PyJWTError,ValueError):
        raise HTTPException(401,"invalid_owner_session")
    if identity.get("email_verified") is not True:
        raise HTTPException(403,"verified_owner_email_required")
    async with request.app.state.db.acquire() as con:
        async with con.transaction():
            row=await con.fetchrow(
              """SELECT p.owner_email,d.encrypted_key
                 FROM growth_ops.child_panels p JOIN growth_ops.panel_credential_delivery d ON d.panel_id=p.id
                 WHERE p.id=$1 AND p.subscription_status='ACTIVE' FOR UPDATE OF d""",panel_id)
            if not row: raise HTTPException(404,"credential_not_available")
            if not hmac.compare_digest(str(identity.get("email","")).lower(),row["owner_email"]):
                raise HTTPException(403,"owner_mismatch")
            payload=bytes(row["encrypted_key"])
            k=base64.b64decode(os.environ.get("LITIX_API_KEY_WRAP_KEY_B64",""))
            if len(k)!=32:raise HTTPException(503,"credential_vault_unavailable")
            key=AESGCM(k).decrypt(payload[:12],payload[12:],b"litix-direct-panel").decode()
            await con.execute("DELETE FROM growth_ops.panel_credential_delivery WHERE panel_id=$1",panel_id)
            return {"api_key":key,"display_once":True}
