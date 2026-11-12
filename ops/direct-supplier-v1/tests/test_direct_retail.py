import os
import sys
from pathlib import Path
from uuid import uuid4
import pytest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"backend"))
from retail_api import SUPPORTED, RetailOrder, merchant_configured, NMI_TRANSACTION_URL

def example():
    return {"serviceKind":"creative_kit","idempotencyKey":str(uuid4()),
            "email":"customer@example.com",
            "brief":{"brand":"Litix","campaign":"New launch",
                     "audience":"Independent creators","pain":"Slow content planning",
                     "solution":"Original creative drafts","cta":"View our work",
                     "landingUrl":"https://www.litix.net/direct-services"},
            "paymentToken":"collect_valid_example_token","expectedAmountCents":300}

def test_single_owned_service_only():
    assert SUPPORTED=={"creative_kit"}
    assert "transactiongateway.com" in NMI_TRANSACTION_URL
    assert RetailOrder.model_validate(example()).serviceKind=="creative_kit"

def test_creative_brief_requires_https_and_complete_fields():
    bad=example();bad["brief"]["landingUrl"]="http://example.com"
    with pytest.raises(ValueError):RetailOrder.model_validate(bad)
    bad=example();bad["brief"].pop("campaign")
    with pytest.raises(ValueError):RetailOrder.model_validate(bad)

def test_retail_payments_fail_closed(monkeypatch):
    for key in ("LITIX_DIRECT_RETAIL_PAYMENTS_ENABLED",
                "LITIX_NMI_PAYMENT_SECURITY_KEY","LITIX_NMI_QUERY_SECURITY_KEY",
                "LITIX_NMI_TEST_MODE","LITIX_NMI_ACCOUNT_CURRENCY"):
        monkeypatch.delenv(key,raising=False)
    assert not merchant_configured()
    monkeypatch.setenv("LITIX_DIRECT_RETAIL_PAYMENTS_ENABLED","true")
    monkeypatch.setenv("LITIX_NMI_PAYMENT_SECURITY_KEY","x"*32)
    monkeypatch.setenv("LITIX_NMI_TEST_MODE","false")
    monkeypatch.setenv("LITIX_NMI_ACCOUNT_CURRENCY","USD")
    assert not merchant_configured()
    monkeypatch.setenv("LITIX_NMI_QUERY_SECURITY_KEY","q"*32)
    assert merchant_configured()
    monkeypatch.setenv("LITIX_NMI_TEST_MODE","true")
    assert not merchant_configured()

def test_migration_additive_unique_and_no_vendor_columns():
    sql=(ROOT/"db"/"008_direct_retail_checkout.sql").read_text()
    assert "CREATE TABLE IF NOT EXISTS growth_ops.direct_retail_orders" in sql
    assert "idempotency_key UUID NOT NULL UNIQUE" in sql
    assert "retail_order_id UUID UNIQUE" in sql
    for keyword in ("DROP TABLE","TRUNCATE","supplier_order_id","boostero"):
        assert keyword not in sql
