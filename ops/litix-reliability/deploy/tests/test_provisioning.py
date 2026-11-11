import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from litix_reliability.preflight import validate_configuration


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


class ProvisioningSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.good = {
            "DATABASE_URL": "postgresql://litix_user:secret@ep-private.neon.tech/neondb?sslmode=require",
            "REDIS_URL": "rediss://default:secret@redis.private.test:6380/0",
            "LITIX_TELEMETRY_SIGNING_SECRET": "x" * 48,
            "LITIX_OWNED_TELEMETRY_ENABLED": "true",
            "LITIX_OWNED_WEBHOOKS_ENABLED": "true",
            "LITIX_WEBHOOK_ALLOWED_HOSTS": "listener.example.net",
            "LITIX_WEBHOOK_ENDPOINT_CONFIG_JSON": '{"customer":{"url":"https://listener.example.net/status","secret":"longplaceholder"}}',
        }

    def test_telemetry_config_validates(self) -> None:
        validate_configuration("telemetry", self.good)

    def test_webhook_config_validates(self) -> None:
        validate_configuration("webhooks", self.good)

    def test_disabled_by_default(self) -> None:
        data = self.good.copy()
        data["LITIX_OWNED_TELEMETRY_ENABLED"] = "false"
        with self.assertRaises(RuntimeError):
            validate_configuration("telemetry", data)

    def test_rejects_localhost_example_redis(self) -> None:
        data = self.good.copy()
        data["REDIS_URL"] = "redis://localhost:6379/0"
        with self.assertRaises(RuntimeError):
            validate_configuration("telemetry", data)

    def test_rejects_remote_redis_without_tls(self) -> None:
        data = self.good.copy()
        data["REDIS_URL"] = "redis://default:secret@redis.private.test:6380/0"
        with self.assertRaises(RuntimeError):
            validate_configuration("telemetry", data)

    def test_rejects_database_without_explicit_tls(self) -> None:
        data = self.good.copy()
        data["DATABASE_URL"] = "postgresql://ops_user:secret@ep-private.neon.tech/neondb"
        with self.assertRaises(RuntimeError):
            validate_configuration("telemetry", data)

    def test_rejects_short_signing_secret(self) -> None:
        data = self.good.copy()
        data["LITIX_TELEMETRY_SIGNING_SECRET"] = "weak"
        with self.assertRaises(RuntimeError):
            validate_configuration("telemetry", data)

    def test_rejects_no_approved_callbacks(self) -> None:
        data = self.good.copy()
        data["LITIX_WEBHOOK_ALLOWED_HOSTS"] = ""
        with self.assertRaises(RuntimeError):
            validate_configuration("webhooks", data)

    def test_nonroot_units_with_startup_preflight(self) -> None:
        for file in ("deploy/litix-telemetry.service", "deploy/litix-webhooks.service"):
            body = read(file)
            self.assertIn("User=litix", body)
            self.assertIn("NoNewPrivileges=yes", body)
            self.assertIn("ProtectSystem=strict", body)
            self.assertIn("ExecStartPre=", body)
            self.assertNotIn("User=root", body)
            self.assertNotIn("postgresql://", body)
            self.assertNotIn("redis://", body)
            self.assertNotIn("pip install", body)

    def test_installer_does_not_start_services(self) -> None:
        body = read("deploy/install-on-vm.sh")
        self.assertNotRegex(body, r"(?m)^\s*systemctl\s+(start|restart|enable)\b")
        self.assertNotIn("apt-get", body)
        self.assertNotIn("pip3 install", body)
        self.assertIn("--no-index", body)
        self.assertIn("LITIX_APPROVED_WHEELHOUSE", body)

    def test_environment_template_is_disabled_and_secret_free(self) -> None:
        env = read("deploy/reliability.env.example")
        self.assertIn("LITIX_OWNED_TELEMETRY_ENABLED=false", env)
        self.assertIn("LITIX_OWNED_WEBHOOKS_ENABLED=false", env)
        self.assertNotIn("postgresql://", env)
        self.assertNotIn("redis://", env)
        self.assertNotIn("secure_pass", env)

if __name__ == "__main__":
    unittest.main()
