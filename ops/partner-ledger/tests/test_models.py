import hashlib
import hmac
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from litix_partner_ledger.models import review_state, verify_observation
from litix_partner_ledger.worker import validate_runtime

SECRET = "an-unpredictable-authorized-worker-secret-placeholder-example-44"
NOW = datetime(2026, 11, 10, 23, 0, tzinfo=timezone.utc)


def signed_data(data=None):
    event = dict(
        event_id=str(uuid4()), order_id=str(uuid4()), observed_units=7,
        observed_at=NOW.isoformat(), evidence_sha256="a" * 64
    )
    if data:
        event.update(data)
    body=json.dumps(event,separators=(",",":"))
    signature="sha256="+hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).hexdigest()
    return body,signature


class EvidenceTests(unittest.TestCase):
    def test_signed_observation_valid(self):
        body,sign=signed_data()
        event=verify_observation(body,sign,SECRET,now=NOW)
        self.assertEqual(event.observed_units,7)
        self.assertEqual(event.evidence_sha256,"a"*64)

    def test_tampered_event_rejected(self):
        body,sign=signed_data()
        with self.assertRaises(ValueError):
            verify_observation(body.replace('"observed_units":7','"observed_units":9'),sign,SECRET,now=NOW)

    def test_missing_signature_rejected(self):
        body,_=signed_data()
        with self.assertRaises(ValueError):
            verify_observation(body,"",SECRET,now=NOW)

    def test_boolean_as_count_rejected(self):
        body,sign=signed_data({"observed_units":True})
        with self.assertRaises(ValueError):
            verify_observation(body,sign,SECRET,now=NOW)

    def test_unsigned_timestamp_rejected(self):
        body,sign=signed_data({"observed_at":"2026-11-10T23:00:00"})
        with self.assertRaises(ValueError):
            verify_observation(body,sign,SECRET,now=NOW)

    def test_invalid_proof_rejected(self):
        body,sign=signed_data({"evidence_sha256":"untrusted"})
        with self.assertRaises(ValueError):
            verify_observation(body,sign,SECRET,now=NOW)

    def test_unverified_completion_never_complete(self):
        self.assertEqual(review_state(requested=10, observed=10, previous=9, has_evidence=False),"NEEDS_REVIEW")
        self.assertEqual(review_state(requested=10, observed=10, previous=9, has_evidence=True),"AWAITING_VERIFICATION")

    def test_measured_drop_flagged_review(self):
        self.assertEqual(review_state(requested=10,observed=6,previous=9,has_evidence=True),"NEEDS_REVIEW")

    def test_partial_not_completed(self):
        self.assertEqual(review_state(requested=10,observed=7,previous=0,has_evidence=False),"PARTIAL")

    def test_overshoot_rejected_for_review(self):
        self.assertEqual(review_state(requested=10,observed=15,previous=0,has_evidence=True),"NEEDS_REVIEW")

    def test_missing_runtime_env_denied(self):
        with self.assertRaises(RuntimeError):
            validate_runtime({})

    def test_plain_redis_denied(self):
        env={
            "LITIX_PARTNER_EVIDENCE_ENABLED":"true",
            "DATABASE_URL":"postgresql://worker:pwd@ep-private.neon.tech/neondb?sslmode=require",
            "REDIS_URL":"redis://default:pwd@redis.private.example:6379/0",
            "LITIX_PARTNER_EVIDENCE_SECRET":SECRET
        }
        with self.assertRaises(RuntimeError):
            validate_runtime(env)
        env["REDIS_URL"]="rediss://default:pwd@redis.private.example:6380/0"
        validate_runtime(env)


if __name__ == "__main__":
    unittest.main()
