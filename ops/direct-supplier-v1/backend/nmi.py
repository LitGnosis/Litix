"""NMI verification: signatures prove sender, Query API proves completed settlement."""
import hashlib
import hmac
import os
from decimal import Decimal, InvalidOperation
from defusedxml import ElementTree as ET
import httpx

NMI_QUERY_URL = "https://secure.nmi.com/api/query.php"
NMI_TEST_QUERY_URL = "https://sandbox.nmi.com/api/query.php"

class NmiVerificationError(ValueError):
    pass

def verify_signature(body: bytes, header: str, secret: str) -> bool:
    if len(body) > 65536 or not secret or len(header) > 256:
        return False
    parts = dict(token.split("=", 1) for token in header.split(",") if token.count("=") == 1)
    nonce, supplied = parts.get("t", ""), parts.get("s", "")
    if not (1 <= len(nonce) <= 128 and len(supplied) == 64 and
            all(c.isalnum() or c in "-_" for c in nonce)):
        return False
    digest = hmac.new(secret.encode(), nonce.encode() + b"." + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, supplied.lower())

def cents(amount: str) -> int:
    try:
        value = Decimal(str(amount))
        if not value.is_finite() or value < 0 or value.as_tuple().exponent < -2:
            raise NmiVerificationError("invalid_money_precision")
        result = int(value * 100)
        if Decimal(result) / 100 != value:
            raise NmiVerificationError("invalid_money")
        return result
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise NmiVerificationError("invalid_money") from exc

async def query_completed_transaction(transaction_id: str, order_id: str | None, expected_cents: int, subscription_id: str | None = None) -> dict:
    key = os.environ.get("LITIX_NMI_QUERY_SECURITY_KEY", "")
    if not key or len(key) < 16:
        raise NmiVerificationError("nmi_query_key_unavailable")
    if not transaction_id.isdigit() or len(transaction_id) > 32:
        raise NmiVerificationError("invalid_nmi_transaction_id")
    url = NMI_TEST_QUERY_URL if os.environ.get("LITIX_NMI_TEST_MODE") == "true" else NMI_QUERY_URL
    if order_id is None and not subscription_id:
        raise NmiVerificationError("nmi_order_or_subscription_identity_required")
    payload={"security_key":key,"transaction_id":transaction_id,"condition":"complete", "action_type":"sale,capture"}
    if subscription_id:
        if len(subscription_id)>80 or not subscription_id.isdigit():
            raise NmiVerificationError("invalid_subscription_id")
        payload["subscription_id"]=subscription_id
    if order_id:
        payload["order_id"]=order_id
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        response = await client.post(url, data=payload,
                                     headers={"accept": "application/xml"})
        response.raise_for_status()
    if len(response.content) > 200_000:
        raise NmiVerificationError("nmi_report_too_large")
    root = ET.fromstring(response.content)
    txs = root.findall(".//transaction")
    if len(txs) != 1:
        raise NmiVerificationError("nmi_transaction_not_unique")
    tx = txs[0]
    if tx.findtext("transaction_id") != transaction_id or (order_id is not None and tx.findtext("order_id") != order_id):
        raise NmiVerificationError("nmi_transaction_identity_mismatch")
    if tx.findtext("condition") != "complete":
        raise NmiVerificationError("nmi_transaction_not_settled")
    reported = tx.findtext("amount")
    if reported is None or cents(reported) != expected_cents:
        raise NmiVerificationError("nmi_settled_amount_mismatch")
    currency = (tx.findtext("currency") or os.environ.get("LITIX_NMI_ACCOUNT_CURRENCY", "")).upper()
    if currency != "USD":
        raise NmiVerificationError("nmi_currency_not_confirmed_usd")
    return {"transaction_id":transaction_id,"order_id":order_id,"subscription_id":subscription_id,
            "amount_cents":expected_cents,"currency":"USD",
            "settlement_ref":"nmi-query:"+transaction_id}
