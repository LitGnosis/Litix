import base64
import hashlib
import hmac
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from nmi import verify_signature, cents, NmiVerificationError
from node_api import SignedNodeMessage, canonical
from api import Application, PRICES, MAX_HANDLES

def test_hmac_valid_tamper_and_replay_data():
    secret = "fixed-unit-test-secret"
    raw = b'{"event_id":"unique-test","event_type":"transaction.sale.success"}'
    nonce = "testnonce92"
    sig = hmac.new(secret.encode(), nonce.encode()+b"."+raw, hashlib.sha256).hexdigest()
    header = f"t={nonce},s={sig}"
    assert verify_signature(raw,header,secret)
    assert not verify_signature(raw+b" ",header,secret)
    assert not verify_signature(raw,header,"wrong")
    assert not verify_signature(raw,header[:-1]+"0",secret) or header.endswith("0")
    assert not verify_signature(raw,"t=bad,s=nothex",secret)

def test_money_conversion_exact():
    assert cents("149.00")==14900
    assert cents("500.00")==50000
    assert cents("1500")==150000
    with pytest.raises(NmiVerificationError): cents("12.999")
    with pytest.raises(NmiVerificationError): cents("-1")
    with pytest.raises(NmiVerificationError): cents("inf")

def test_plan_rates_and_capacity():
    assert PRICES == {"PANEL_149_WK":14900,"AGENCY_500_WK":50000,"ENTERPRISE_1500_WK":150000}
    assert MAX_HANDLES == {"AGENCY_500_WK":25,"ENTERPRISE_1500_WK":100}
    assert Application(tier="AGENCY_500_WK",owner_email="Buyer@EXAMPLE.COM",agency_name="My Shop").owner_email=="buyer@example.com"
    with pytest.raises(ValueError): Application(tier="UNKNOWN",owner_email="buyer@example.com")
    with pytest.raises(ValueError): Application(tier="PANEL_149_WK",owner_email="buyer@example.com",custom_domain="localhost")

def test_node_ed25519_canonical_proof():
    private = Ed25519PrivateKey.generate()
    payload = SignedNodeMessage(
        node_name="litix-direct-primary-01",event_id="123e4567-e89b-12d3-a456-426614174000",
        signed_at=datetime.now(timezone.utc),nonce="a"*48,action="receipt",
        job_id="123e4567-e89b-12d3-a456-426614174001",
        evidence_sha256="b"*64,observed_units=1,
        artifact={"service_kind":"post_monitoring","observed_post":{}},signature_b64="abc"
    )
    original=canonical(payload)
    sig=private.sign(original)
    private.public_key().verify(sig,original)
    with pytest.raises(Exception): private.public_key().verify(sig,original+b" ")
