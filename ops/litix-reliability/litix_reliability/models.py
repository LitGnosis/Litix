"""Evidence-based state changes for first-party Litix deliverables only."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
import json
import re
from typing import Any, Mapping
from uuid import UUID

KINDS = frozenset({"website_preview", "owned_app_qa"})

@dataclass(frozen=True)
class Event:
    event_id: UUID
    order_id: str
    kind: str
    observed_units: int
    observed_at: datetime
    evidence_ref: str | None

@dataclass(frozen=True)
class Assessment:
    status: str
    remains: int
    drop_detected: bool
    needs_review: bool

def signature(body: bytes, key: str) -> str:
    if len(key.encode()) < 32:
        raise ValueError("secret_must_be_at_least_32_bytes")
    return hmac.new(key.encode(), body, sha256).hexdigest()

def verified_event(raw: str, signed: str, key: str, *, now: datetime | None = None) -> Event:
    data = raw.encode()
    if len(data) > 4096 or len(data) < 30 or not isinstance(signed,str):
        raise ValueError("invalid_payload")
    if not re.fullmatch(r"[0-9a-fA-F]{64}",signed) or not hmac.compare_digest(signature(data,key),signed.lower()):
        raise ValueError("invalid_signature")
    try:
        event: Any = json.loads(raw)
    except (TypeError,ValueError) as ex:
        raise ValueError("invalid_json") from ex
    if not isinstance(event,dict) or set(event) != {"event_id","order_id","kind","observed_units","observed_at","evidence_ref"}:
        raise ValueError("invalid_event_shape")
    try:
        uid = UUID(event["event_id"])
        timestamp = datetime.fromisoformat(event["observed_at"].replace("Z","+00:00"))
    except (ValueError,AttributeError,TypeError) as ex:
        raise ValueError("invalid_id_or_timestamp") from ex
    if timestamp.tzinfo is None:
        raise ValueError("timestamp_requires_zone")
    current = now or datetime.now(timezone.utc)
    if timestamp > current+timedelta(seconds=60) or timestamp < current-timedelta(days=7):
        raise ValueError("outside_recovery_window")
    order = event["order_id"]
    if not isinstance(order,str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,100}",order):
        raise ValueError("invalid_order_id")
    if not isinstance(event["kind"],str) or event["kind"] not in KINDS:
        raise ValueError("unsupported_workload")
    units = event["observed_units"]
    if isinstance(units,bool) or not isinstance(units,int) or not 0<=units<=1000000:
        raise ValueError("invalid_count")
    proof = event["evidence_ref"]
    if proof is not None and (not isinstance(proof,str) or not re.fullmatch(r"[A-Za-z0-9._:/-]{12,200}",proof)):
        raise ValueError("invalid_proof_reference")
    return Event(uid,order,event["kind"],units,timestamp,proof)

def assess(*, target: int, current: int, previous: int | None = None,
           completed_with_matching_evidence: bool = False) -> Assessment:
    if isinstance(target,bool) or isinstance(current,bool) or not isinstance(target,int) or not isinstance(current,int) or target<1 or current<0:
        raise ValueError("invalid_counts")
    if previous is not None and (isinstance(previous,bool) or not isinstance(previous,int) or previous<0):
        raise ValueError("invalid_previous_count")
    drop = previous is not None and previous>0 and current<previous and (previous-current)/previous>0.05
    remains = max(0,target-current)
    status = ("NEEDS_REVIEW" if drop else
              "COMPLETED" if current>=target and completed_with_matching_evidence else
              "AWAITING_VERIFICATION" if current>=target else
              "PARTIAL" if current>0 else "PENDING")
    return Assessment(status,remains,drop,drop or status=="AWAITING_VERIFICATION")

def webhook_body(payload: Mapping[str,Any]) -> bytes:
    return json.dumps(payload,separators=(",",":"),sort_keys=True,ensure_ascii=True).encode()

def webhook_signature(payload: Mapping[str,Any],event_id: str,timestamp: int,key: str) -> str:
    return signature(f"{timestamp}.{event_id}.".encode()+webhook_body(payload),key)
