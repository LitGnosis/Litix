import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

class RailwaySafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.iac = (ROOT / ".railway/railway.ts").read_text()
        cls.worker = (ROOT / "ops/partner-ledger/litix_partner_ledger/worker.py").read_text()
        cls.requirements = (ROOT / "ops/partner-ledger/requirements.txt").read_text()

    def test_true_worker_entrypoint(self):
        self.assertIn('start: "python -u -m litix_partner_ledger.worker"', self.iac)
        self.assertIn('async def run()', self.worker)

    def test_root_directory_is_actual_package(self):
        self.assertIn('rootDirectory: "ops/partner-ledger"', self.iac)
        self.assertIn("asyncpg", self.requirements)
        self.assertIn("redis", self.requirements)

    def test_one_partial_does_not_manage_storefront(self):
        self.assertIn('export const partial = "litix-owned-evidence-worker"', self.iac)
        self.assertNotIn("litix.net", self.iac)
        self.assertNotIn("master_fulfillment", self.iac)

    def test_railway_worker_starts_disabled(self):
        self.assertIn("replicas: 0", self.iac)
        self.assertIn('LITIX_PARTNER_EVIDENCE_ENABLED: "false"', self.iac)

    def test_secrets_not_hardcoded(self):
        self.assertIn("DATABASE_URL: preserve()", self.iac)
        self.assertIn("REDIS_URL: preserve()", self.iac)
        self.assertIn("LITIX_PARTNER_EVIDENCE_SECRET: preserve()", self.iac)
        self.assertNotIn("PAYKINGS_API_KEY", self.iac)
        self.assertNotIn("redis://127.0.0.1", self.iac)

if __name__ == "__main__":
    unittest.main()
