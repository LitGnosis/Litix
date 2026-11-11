from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import re
from uuid import UUID

_HEX64 = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class DeliveryObservation:
    event_id: UUID
    order_id: UUID
    observed_units: int
    observed_at: datetime
    evidence_sha256: str | None


def verify_observation(
    raw_json: str,
    signature: str,
    secret: str,
    *,
    now: datetime | None = None,
) -> DeliveryObservation:
    if len(secret.encode("utf-8")) < 32:
        raise ValueError("missing_signing_secret")
    if not isinstance(raw_json, str) or len(raw_json.encode("utf-8")) > 4096:
        raise ValueError("invalid_event_size")
    expected = hmac.new(
        secret.encode("utf-8"), raw_json.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not isinstance(signature, str) or not signature.startswith("sha256="):
        raise ValueError("signature_missing")
    provided = signature.removeprefix("sha256=")
    if not _HEX64.fullmatch(provided) or not hmac.compare_digest(expected, provided):
        raise ValueError("signature_invalid")

    try:
        data = json.loads(raw_json)
        if not isinstance(data, dict) or set(data) != {
            "event_id", "order_id", "observed_units", "observed_at", "evidence_sha256"
        }:
            raise ValueError("unexpected_keys")
        event_id = UUID(data["event_id"])
        order_id = UUID(data["order_id"])
        units = data["observed_units"]
        if type(units) is not int or not 0 <= units <= 1_000_000:
            raise ValueError("invalid_observation")
        moment = datetime.fromisoformat(data["observed_at"].replace("Z", "+00:00"))
        if moment.tzinfo is None:
            raise ValueError("timezone_required")
        moment = moment.astimezone(timezone.utc)
        basis = now or datetime.now(timezone.utc)
        if moment > basis + timedelta(minutes=5) or moment < basis - timedelta(days=7):
            raise ValueError("observation_outside_valid_window")
        evidence = data["evidence_sha256"]
        if evidence is not None and (not isinstance(evidence, str) or
                                     not _HEX64.fullmatch(evidence)):
            raise ValueError("invalid_evidence_hash")
    except (TypeError, KeyError, json.JSONDecodeError, AttributeError, OverflowError) as exc:
        raise ValueError("malformed_event") from exc

    return DeliveryObservation(
        event_id=event_id, order_id=order_id, observed_units=units,
        observed_at=moment, evidence_sha256=evidence,
    )


def review_state(
    *,
    requested: int,
    observed: int,
    previous: int,
    has_evidence: bool,
) -> str:
    if not (0 < requested <= 1_000_000 and 0 <= observed <= 1_000_000 and
            0 <= previous <= requested):
        raise ValueError("invalid_delivery_counts")
    if observed < previous or observed > requested:
        return "NEEDS_REVIEW"
    if observed == requested:
        return "AWAITING_VERIFICATION" if has_evidence else "NEEDS_REVIEW"
    return "PARTIAL" if observed > 0 else "PENDING"
