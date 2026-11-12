"""Litix-owned retail checkout. Charge only with evidenced signed node capacity.
No engagement resellers, synthetic traffic, unverified receipts or payment retries.
"""
from __future__ import annotations

import hmac
import json
import logging
import os
import re
from decimal import Decimal
from uuid import UUID
from urllib.parse import parse_qs
import asyncpg
import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from nmi import query_completed_transaction, NmiVerificationError

router=APIRouter(prefix="/v1/internal/retail",tags=["litix-owned-retail"])
LOG=logging.getLogger("litix.direct.retail")
EMAIL=re.compile(r"^[^\s@]{1,64}@[^\s@]{2,190}\.[A-Za-z]{2,24}$")
SUPPORTED={"creative_kit"}
REQUIRED_BRIEF={"brand","campaign","audience","pain","solution","cta","landingUrl"}
NMI_TRANSACTION_URL="https://paykings.transactiongateway.com/api/transact.php"

def authorize(request:Request)->None:
    token=os.environ.get("LITIX_INTERNAL_SERVICE_TOKEN","")
    if len(token)<32 or not hmac.compare_digest(
      request.headers.get("authorization",""),"Bearer "+token):
        raise HTTPException(status_code=401,detail="internal_access_required")

def merchant_configured()->bool:
    return bool(
      os.environ.get("LITIX_DIRECT_RETAIL_PAYMENTS_ENABLED")=="true"
      and len(os.environ.get("LITIX_NMI_PAYMENT_SECURITY_KEY",""))>=16
      and len(os.environ.get("LITIX_NMI_QUERY_SECURITY_KEY",""))>=16
      and os.environ.get("LITIX_NMI_TEST_MODE")=="false"
      and os.environ.get("LITIX_NMI_ACCOUNT_CURRENCY")=="USD"
    )

async def owned_capacity(con,kind:str)->bool:
    """No production retail charge without an authorized node and prior signed output."""
    return bool(await con.fetchval(
      """SELECT EXISTS(
          SELECT 1 FROM growth_ops.first_party_nodes n
          JOIN growth_ops.first_party_node_keys k ON k.node_name=n.node_name
          JOIN growth_ops.direct_node_receipts r ON r.node_name=n.node_name
          JOIN growth_ops.direct_fulfillment_jobs j ON j.id=r.job_id
          WHERE n.status='ONLINE' AND n.last_heartbeat>now()-interval '90 seconds'
            AND k.enabled AND $1=ANY(k.authorized_services)
            AND j.service_kind=$1 AND j.status='COMPLETED'
          )""",kind))

async def eligible_rate(con,kind:str):
    return await con.fetchrow(
      """SELECT rate.unit_price_usd
         FROM growth_ops.direct_service_catalog service
         JOIN growth_ops.direct_service_rates rate USING(service_kind)
         WHERE service.service_kind=$1
           AND service.available AND service.billable AND service.first_party_only
           AND rate.enabled""",kind)

async def release_flags(con)->bool:
    return bool(await con.fetchval(
      """SELECT merchant_settlement_verified AND fulfillment_capacity_verified
                AND recurring_checkout_enabled
         FROM growth_ops.direct_release_gates WHERE id=TRUE"""))

class RetailOrder(BaseModel):
    serviceKind:str=Field(min_length=4,max_length=55)
    idempotencyKey:UUID
    email:str=Field(min_length=5,max_length=254)
    brief:dict[str,str]=Field(max_length=12)
    expectedAmountCents:int=Field(ge=100,le=1000000)
    paymentToken:str=Field(min_length=10,max_length=500)

    @field_validator("email")
    @classmethod
    def check_email(cls,email):
        email=email.strip().lower()
        if not EMAIL.fullmatch(email):
            raise ValueError("valid_customer_email_required")
        return email

    @field_validator("brief")
    @classmethod
    def check_brief(cls,brief):
        if not REQUIRED_BRIEF.issubset(brief):
            raise ValueError("complete_first_party_creative_brief_required")
        for key,value in brief.items():
            if not isinstance(value,str) or len(value)<2 or len(value)>500:
                raise ValueError("invalid_creative_brief_fields")
        if not brief["landingUrl"].startswith("https://"):
            raise ValueError("https_landing_url_required")
        return brief

@router.get("/catalog")
async def catalog(request:Request):
    authorize(request)
    async with request.app.state.db.acquire() as con:
        gates=await release_flags(con)
        rows=await con.fetch(
          """SELECT s.service_kind,r.unit_price_usd
             FROM growth_ops.direct_service_catalog s
             JOIN growth_ops.direct_service_rates r USING(service_kind)
             WHERE s.first_party_only AND s.available AND s.billable AND r.enabled
             ORDER BY s.service_kind""")
        offered=[]
        for row in rows:
            if row["service_kind"] not in SUPPORTED:continue
            if not await owned_capacity(con,row["service_kind"]):continue
            price=int(Decimal(row["unit_price_usd"])*100)
            offered.append({"serviceKind":row["service_kind"],
                            "name":"Original Litix Creative Kit — 12 editable drafts",
                            "priceCents":price})
    return {"currency":"USD","supplier":"Litix-owned only",
            "services":offered if (gates and merchant_configured()) else [],
            "checkoutReady":bool(offered and gates and merchant_configured()),
            "externalSupplierCalls":0,
            "engagementServicesSupported":False}

@router.post("/checkout")
async def checkout(request:Request,body:RetailOrder):
    authorize(request)
    if body.serviceKind not in SUPPORTED:
        raise HTTPException(409,"first_party_engagement_fulfillment_not_verified_no_charge")
    if not re.fullmatch(r"[A-Za-z0-9_.-]{10,500}",body.paymentToken):
        raise HTTPException(422,"valid_gateway_token_required")
    if not merchant_configured():
        raise HTTPException(503,"verified_litix_direct_payment_configuration_required")
    # An accepted payment is NOT a fulfilled deliverable.
    async with request.app.state.db.acquire() as con:
        async with con.transaction():
            existing=await con.fetchrow(
              """SELECT id,payment_state FROM growth_ops.direct_retail_orders
                 WHERE idempotency_key=$1""",body.idempotencyKey)
            if existing:
                return {"orderId":str(existing["id"]),"payment":existing["payment_state"],
                        "duplicate":True,"chargeAttempted":False}
            if not await release_flags(con):
                raise HTTPException(503,"merchant_or_fulfillment_gate_closed")
            rate=await eligible_rate(con,body.serviceKind)
            if not rate or not await owned_capacity(con,body.serviceKind):
                raise HTTPException(503,"first_party_signed_capacity_not_approved")
            price=int(Decimal(rate["unit_price_usd"])*100)
            if price!=body.expectedAmountCents:
                raise HTTPException(409,"verified_first_party_price_changed")
            # This insert is committed before the only NMI charge attempt.
            entry=await con.fetchrow(
              """INSERT INTO growth_ops.direct_retail_orders
                   (idempotency_key,customer_email,service_kind,brief,amount_cents)
                 VALUES($1,$2,$3,$4::jsonb,$5)
                 ON CONFLICT(idempotency_key) DO NOTHING RETURNING id""",
              body.idempotencyKey,body.email,body.serviceKind,
              json.dumps(body.brief),price)
            if not entry:
                return {"payment":"PROCESSING","duplicate":True,"chargeAttempted":False}
    order_id=str(entry["id"])
    try:
        async with httpx.AsyncClient(timeout=18,follow_redirects=False) as client:
            res=await client.post(NMI_TRANSACTION_URL,
                data={"security_key":os.environ["LITIX_NMI_PAYMENT_SECURITY_KEY"],
                      "type":"sale","payment_token":body.paymentToken,
                      "amount":f"{body.expectedAmountCents/100:.2f}",
                      "orderid":order_id,"email":body.email},
                headers={"content-type":"application/x-www-form-urlencoded"})
            res.raise_for_status()
        answer={k:v[-1] for k,v in parse_qs(res.text,keep_blank_values=True).items()}
    except (httpx.HTTPError,ValueError,KeyError):
        await request.app.state.db.execute(
          """UPDATE growth_ops.direct_retail_orders
             SET payment_state='REVIEW',last_error_code='gateway_outcome_unknown',updated_at=NOW()
             WHERE id=$1 AND payment_state='PROCESSING'""",entry["id"])
        return {"orderId":order_id,"payment":"REVIEW","chargeAttempted":True,
                "message":"Payment outcome uncertain. Do not submit a second payment."}
    if answer.get("response")!="1" or answer.get("response_code")!="100":
        await request.app.state.db.execute(
          """UPDATE growth_ops.direct_retail_orders
             SET payment_state='DECLINED',last_error_code='gateway_declined',updated_at=NOW()
             WHERE id=$1 AND payment_state='PROCESSING'""",entry["id"])
        return {"orderId":order_id,"payment":"DECLINED","chargeAttempted":True}
    transaction_id=str(answer.get("transactionid",""))
    if not re.fullmatch(r"[0-9]{5,32}",transaction_id):
        await request.app.state.db.execute(
          """UPDATE growth_ops.direct_retail_orders
             SET payment_state='REVIEW',last_error_code='missing_transaction_id',updated_at=NOW()
             WHERE id=$1 AND payment_state='PROCESSING'""",entry["id"])
        return {"orderId":order_id,"payment":"REVIEW","chargeAttempted":True,
                "message":"Payment requires merchant reconciliation. Do not retry."}
    await request.app.state.db.execute(
      """UPDATE growth_ops.direct_retail_orders
         SET gateway_transaction_id=$2,payment_state='APPROVED_PENDING_SETTLEMENT',updated_at=NOW()
         WHERE id=$1 AND payment_state='PROCESSING'""",entry["id"],transaction_id)
    # Settlement must be independently verified before a worker may receive the order.
    return {"orderId":order_id,"payment":"APPROVED_PENDING_SETTLEMENT",
            "chargeAttempted":True,"fulfillment":"AWAITING_SETTLEMENT",
            "message":"Card approved. Direct fulfillment waits for confirmed settlement."}

@router.post("/reconcile")
async def reconcile(request:Request):
    authorize(request)
    if not os.environ.get("LITIX_NMI_QUERY_SECURITY_KEY"):
        raise HTTPException(503,"nmi_query_api_key_required")
    rows=await request.app.state.db.fetch(
      """SELECT id,service_kind,brief,customer_email,amount_cents,gateway_transaction_id
         FROM growth_ops.direct_retail_orders
         WHERE payment_state='APPROVED_PENDING_SETTLEMENT'
           AND gateway_transaction_id IS NOT NULL
         ORDER BY created_at LIMIT 20""")
    states=[]
    for row in rows:
        try:
            await query_completed_transaction(row["gateway_transaction_id"],
                                               str(row["id"]),row["amount_cents"])
        except (NmiVerificationError,httpx.HTTPError,ValueError):
            states.append("not_yet_verified");continue
        async with request.app.state.db.acquire() as con:
            async with con.transaction():
                locked=await con.fetchrow(
                  """SELECT id,payment_state FROM growth_ops.direct_retail_orders
                     WHERE id=$1 FOR UPDATE""",row["id"])
                if not locked or locked["payment_state"]!="APPROVED_PENDING_SETTLEMENT":
                    states.append("already_processed");continue
                await con.execute(
                  """INSERT INTO growth_ops.direct_fulfillment_jobs
                     (retail_order_id,service_kind,request)
                     VALUES($1,$2,$3::jsonb)
                     ON CONFLICT(retail_order_id) DO NOTHING""",
                  row["id"],row["service_kind"],json.dumps({
                    "brief":row["brief"],"retail_order_id":str(row["id"]),
                    "fulfillmentScope":"owned_creative_only",
                    "payment":"nmi_independently_settled"}))
                await con.execute(
                  """UPDATE growth_ops.direct_retail_orders
                     SET payment_state='SETTLED',settled_at=NOW(),updated_at=NOW()
                     WHERE id=$1 AND payment_state='APPROVED_PENDING_SETTLEMENT'""",row["id"])
                states.append("settled_and_queued_for_owned_node")
    return {"reviewed":len(rows),"states":states,
            "queue":"litix:fulfillment:queue","supplierApiCalls":0}
