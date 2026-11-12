"""No-charge direct routing contract; no seller APIs, merchant charges, or fabricated delivery."""
import sys
from pathlib import Path

from pydantic import ValidationError
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from direct_order_api import DirectCreativeOrder, REQUIRED

BRIEF = {
    "brand": "Litix",
    "campaign": "Fresh content launch",
    "audience": "Independent businesses",
    "pain": "Inconsistent original content planning",
    "solution": "Editorial planning and 12 owned creative drafts",
    "cta": "See the Litix content tools",
    "landingUrl": "https://www.litix.net/direct-services",
}

def test_first_party_creative_brief_valid():
    p = DirectCreativeOrder(
        service_kind="creative_kit", idempotency_key="unique-own-job-20261111",
        brief=BRIEF,
    )
    assert set(p.brief) == set(REQUIRED)

@pytest.mark.parametrize("kind", ["instagram_likes", "followers", "streams", "boostero_123"])
def test_no_unverified_paid_engagement(kind):
    with pytest.raises(ValidationError):
        DirectCreativeOrder(service_kind=kind, idempotency_key="unique-own-job-20261111", brief=BRIEF)

def test_reject_short_order_key():
    with pytest.raises(ValidationError):
        DirectCreativeOrder(service_kind="creative_kit", idempotency_key="short", brief=BRIEF)

def test_reject_social_post_as_landing_page():
    with pytest.raises(ValidationError):
        DirectCreativeOrder(
            service_kind="creative_kit", idempotency_key="unique-own-job-20261111",
            brief={**BRIEF, "landingUrl": "http://localhost/secret"},
        )

def test_reject_missing_brief_fields():
    with pytest.raises(ValidationError):
        DirectCreativeOrder(
            service_kind="creative_kit", idempotency_key="unique-own-job-20261111",
            brief={k: v for k,v in BRIEF.items() if k != "cta"},
        )
