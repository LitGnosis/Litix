"""Wholesale direct API: funded and idempotent Litix-owned creative orders only."""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import re
from decimal import Decimal
from uuid import UUID
import asyncpg
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from nmi import query_completed_transaction, NmiVerificationError

router=APIRouter(prefix="/v1",tags=["wholesale"])
MONEY=Decimal("0.01")
KINDS={"creative_kit"}
KEY_PATTERN=re.compile(r"^lx_live_[A-Za-z0-9_-]{40,120}$")
IDEMPOTENCY=re.compile(r"^[A-Za-z0-9_-]{16,128}$")

class Order(BaseModel):
    service_kind: str
    idempotency_key: str=Field(min_length=16,max_length=128)
    brief: dict=Field(max_length=12)

class TopupIntent(BaseModel):
    panel_id:UUID
    transaction_id:str=Field(min_length=4,max_length=120)
    order_reference:str=Field(min_length=8,max_length=120)
    expected_amount_cents:int=Field(ge=100,le=5000000)

def internal(request:Request):
    token=os.environ.get("LITIX_INTERNAL_SERVICE_TOKEN","")
    if len(token)<32 or not hmac.compare_digest(request.headers.get("authorization",""),"Bearer "+token):
        raise HTTPException(401,"internal_credential_required")

async def auth_panel(request:Request):
    key=request.headers.get("x-litix-api-key","")
    if not KEY_PATTERN.fullmatch(key):
        raise HTTPException(401,"invalid_panel_key")
    digest=hashlib.sha256(key.encode()).hexdigest()
    pool=request.app.state.db
    panel=await pool.fetchrow(
      """SELECT id,owner_email,subscription_status,wholesale_balance_usd
         FROM growth_ops.child_panels
         WHERE api_key_hash=$1 AND subscription_status='ACTIVE'""",digest)
    if not panel:raise HTTPException(403,"panel_not_active_or_key_invalid")
    counter=f"litix:panel:rate:{panel['id']}"
    used=await request.app.state.redis.incr(counter)
    if used==1:await request.app.state.redis.expire(counter,60)
    if used>60:raise HTTPException(429,"panel_rate_limit")
    return panel

@router.get("/panels/services")
async def services(request:Request):
    await auth_panel(request)
    rows=await request.app.state.db.fetch(
       """SELECT s.service_kind,r.unit_price_usd
          FROM growth_ops.direct_service_catalog s
          JOIN growth_ops.direct_service_rates r ON r.service_kind=s.service_kind
          WHERE s.available AND s.first_party_only AND s.billable AND r.enabled
          ORDER BY s.service_kind""")
    return {"supplier":"Litix-owned","currency":"USD",
            "services":[{"kind":r["service_kind"],"unitPriceUsd":str(r["unit_price_usd"])} for r in rows]}

@router.post("/panels/orders")
async def create_owned_order(request:Request,payload:Order):
    panel=await auth_panel(request)
    if not IDEMPOTENCY.fullmatch(payload.idempotency_key):
        raise HTTPException(422,"invalid_idempotency_key")
    if payload.service_kind not in KINDS:
        raise HTTPException(422,"no_verified_first_party_delivery_for_service")
    brief=payload.brief
    must=("brand","campaign","audience","pain","solution","cta","landingUrl")
    if any(not isinstance(brief.get(k),str) or not 2<=len(brief[k])<=500 for k in must):
        raise HTTPException(422,"complete_creative_brief_required")
    if not brief["landingUrl"].startswith("https://"):
        raise HTTPException(422,"valid_https_landing_page_required")
    async with request.app.state.db.acquire() as con:
        async with con.transaction():
            locked=await con.fetchrow(
              """SELECT id,wholesale_balance_usd
                 FROM growth_ops.child_panels WHERE id=$1 AND subscription_status='ACTIVE'
                 FOR UPDATE""",panel["id"])
            if not locked:raise HTTPException(403,"panel_suspended")
            previous=await con.fetchrow(
              """SELECT id,status FROM growth_ops.child_panel_orders
                 WHERE panel_id=$1 AND idempotency_key=$2""",panel["id"],payload.idempotency_key)
            if previous:
                return {"id":str(previous["id"]),"state":previous["status"],
                        "idempotentReplay":True,"supplier":"Litix"}
            rate=await con.fetchrow(
              """SELECT s.service_kind,r.unit_price_usd
                 FROM growth_ops.direct_service_catalog s
                 JOIN growth_ops.direct_service_rates r ON r.service_kind=s.service_kind
                 WHERE s.service_kind=$1 AND s.available AND s.billable
                   AND s.first_party_only AND r.enabled FOR SHARE""",payload.service_kind)
            if not rate:raise HTTPException(409,"verified_rate_and_capacity_not_activated")
            price=Decimal(rate["unit_price_usd"]).quantize(MONEY)
            if Decimal(locked["wholesale_balance_usd"])<price:
                raise HTTPException(402,"insufficient_verified_wallet_balance")
            active=await con.fetchval(
              """SELECT count(*) FROM growth_ops.first_party_nodes n
                 JOIN growth_ops.first_party_node_keys k ON k.node_name=n.node_name
                 WHERE n.status='ONLINE' AND n.last_heartbeat>NOW()-INTERVAL '90 seconds'
                   AND k.enabled AND 'creative_kit'=ANY(k.authorized_services)""")
            if active<1:raise HTTPException(503,"no_healthy_owned_delivery_node")
            row=await con.fetchrow(
               """INSERT INTO growth_ops.child_panel_orders
                  (panel_id,idempotency_key,service_kind,unit_price_usd)
                  VALUES($1,$2,$3,$4) RETURNING id""",
               panel["id"],payload.idempotency_key,payload.service_kind,price)
            await con.execute(
              """UPDATE growth_ops.child_panels
                 SET wholesale_balance_usd=wholesale_balance_usd-$2,updated_at=NOW()
                 WHERE id=$1""",panel["id"],price)
            await con.execute(
              """INSERT INTO growth_ops.child_panel_wallet_entries
                 (panel_id,source_payment_id,amount_usd,entry_type)
                 VALUES($1,$2,$3,'DEBIT')""",
              panel["id"],"panelorder:"+str(row["id"]),price)
            await con.execute(
              """INSERT INTO growth_ops.direct_fulfillment_jobs
                 (panel_order_id,service_kind,request)
                 VALUES($1,'creative_kit',$2::jsonb)""",
              row["id"],json.dumps({"brief":brief,"panel_id":str(panel["id"]),
                                    "order_id":str(row["id"]),"consent":"first_party_content"}))
    return {"id":str(row["id"]),"state":"QUEUED","idempotentReplay":False,
            "priceUsd":str(price),"supplier":"Litix"}

@router.post("/internal/topups/intent")
async def register_topup(request:Request,data:TopupIntent):
    internal(request)
    result=await request.app.state.db.fetchrow(
      """INSERT INTO growth_ops.child_panel_wallet_topup_intents
         (panel_id,provider_transaction_id,order_reference,expected_amount_cents)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(provider_transaction_id) DO NOTHING RETURNING id""",
      data.panel_id,data.transaction_id,data.order_reference,data.expected_amount_cents)
    if not result:raise HTTPException(409,"transaction_already_registered")
    return {"intent_id":str(result["id"]),"state":"PENDING","walletCredited":False}

@router.post("/internal/topups/reconcile")
async def reconcile_topups(request:Request):
    internal(request)
    pending=await request.app.state.db.fetch(
      """SELECT * FROM growth_ops.child_panel_wallet_topup_intents
         WHERE state='PENDING' ORDER BY created_at LIMIT 15""")
    status=[]
    for item in pending:
        try:
            # Query API is the only source of truth; inbound webhooks cannot credit funds.
            found=await query_completed_transaction(
                item["provider_transaction_id"],item["order_reference"],item["expected_amount_cents"])
            async with request.app.state.db.acquire() as con:
                async with con.transaction():
                    locked=await con.fetchrow(
                       """SELECT * FROM growth_ops.child_panel_wallet_topup_intents
                          WHERE id=$1 FOR UPDATE""",item["id"])
                    if not locked or locked["state"]!="PENDING":
                        status.append("already_applied");continue
                    amount=(Decimal(locked["expected_amount_cents"])/Decimal(100)).quantize(MONEY)
                    await con.execute(
                       """INSERT INTO growth_ops.child_panel_wallet_entries
                          (panel_id,source_payment_id,amount_usd,entry_type)
                          VALUES($1,$2,$3,'CREDIT')""",
                       locked["panel_id"],found["transaction_id"],amount)
                    await con.execute(
                       """UPDATE growth_ops.child_panels
                          SET wholesale_balance_usd=wholesale_balance_usd+$2,updated_at=NOW()
                          WHERE id=$1""",locked["panel_id"],amount)
                    await con.execute(
                       """UPDATE growth_ops.child_panel_wallet_topup_intents
                          SET state='SETTLED',settled_at=NOW() WHERE id=$1""",locked["id"])
                    status.append("wallet_credited_once")
        except (NmiVerificationError,ValueError,asyncpg.PostgresError):
            status.append("requires_review")
    return {"attempted":len(pending),"results":status,"reseller_api_calls":0}
