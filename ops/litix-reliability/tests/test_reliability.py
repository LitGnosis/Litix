import json
import unittest
from datetime import datetime,timedelta,timezone
from uuid import uuid4
from litix_reliability.models import assess,verified_event,signature,webhook_body,webhook_signature
from litix_reliability.capacity import estimate
from litix_reliability.webhook_dispatcher import load_endpoints

KEY="fixture-secret-only-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

class LitixOwnedReliabilityTests(unittest.TestCase):
    def event(self,when):
        return {"event_id":str(uuid4()),"order_id":"litix_owned_0001",
                "kind":"website_preview","observed_units":1,
                "observed_at":when.isoformat(),"evidence_ref":"artifact/approved/001"}

    def test_initial_partial_is_not_drop(self):
        a=assess(target=100,current=45)
        self.assertEqual((a.status,a.remains,a.drop_detected),("PARTIAL",55,False))

    def test_true_drop_requires_previous_observation(self):
        a=assess(target=100,current=94,previous=100)
        self.assertEqual((a.status,a.remains),("NEEDS_REVIEW",6))

    def test_completion_requires_matching_evidence(self):
        self.assertEqual(assess(target=1,current=1).status,"AWAITING_VERIFICATION")
        self.assertEqual(assess(target=1,current=1,completed_with_matching_evidence=True).status,"COMPLETED")

    def test_event_signature_detects_tampering(self):
        raw=json.dumps(self.event(datetime.now(timezone.utc)))
        event=verified_event(raw,signature(raw.encode(),KEY),KEY)
        self.assertEqual(event.kind,"website_preview")
        with self.assertRaisesRegex(ValueError,"signature"):
            verified_event(raw.replace('"observed_units": 1','"observed_units": 2'),
                           signature(raw.encode(),KEY),KEY)

    def test_rejected_synthetic_activity(self):
        obj=self.event(datetime.now(timezone.utc))
        obj["kind"]="synthetic_follows"
        raw=json.dumps(obj)
        with self.assertRaisesRegex(ValueError,"unsupported"):
            verified_event(raw,signature(raw.encode(),KEY),KEY)

    def test_outage_recovery_but_not_replayed_forever(self):
        old=json.dumps(self.event(datetime.now(timezone.utc)-timedelta(days=8)))
        with self.assertRaisesRegex(ValueError,"recovery"):
            verified_event(old,signature(old.encode(),KEY),KEY)

    def test_webhook_signature_order_independent(self):
        a={"event_id":"a","status":"PARTIAL"}
        b={"status":"PARTIAL","event_id":"a"}
        self.assertEqual(webhook_body(a),webhook_body(b))
        self.assertEqual(webhook_signature(a,"a",11,KEY),webhook_signature(b,"a",11,KEY))

    def test_unauthorized_webhook_host(self):
        with self.assertRaisesRegex(ValueError,"approved"):
            load_endpoints(json.dumps({"agency":{"url":"https://127.0.0.1/ingest","secret":KEY}}),
                           "approved.example")
        good=load_endpoints(json.dumps({"agency":{"url":"https://approved.example/ingest","secret":KEY}}),
                            "approved.example")
        self.assertEqual(good["agency"]["host"],"approved.example")

    def test_capacity_zero_unless_nodes_are_verified(self):
        self.assertEqual(estimate(owned_nodes=0,jobs_per_node=1,seconds_per_job=60).expected_jobs_per_hour,0)
        self.assertEqual(estimate(owned_nodes=4,jobs_per_node=2,seconds_per_job=60).protected_slots,6)

if __name__=="__main__":
    unittest.main()
