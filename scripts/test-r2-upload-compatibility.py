#!/usr/bin/env python3
"""Static, secrets-free regression checks. Does not contact Cloudflare or Neon."""
from pathlib import Path
script = Path(__file__).with_name("litix-r2-github-manual-verify.sh").read_text()
assert "--checksum-algorithm" not in script, "Optional S3 checksum headers must not be sent to R2 uploads"
assert 'litix-r2-boto3-transfer.py put "$probe_key" "$work/probe"' in script
assert 'litix-r2-boto3-transfer.py upload "$object" "$encrypted"' in script
assert 'litix-r2-boto3-transfer.py head "$object"' in script
assert 'litix-r2-boto3-transfer.py get "$object" "$work/$db.download.age"' in script
assert "s3api put-object" not in script and "aws --endpoint-url" not in script
adapter = Path(__file__).with_name("litix-r2-boto3-transfer.py").read_text()
for item in (
  "payload_signing_enabled", "request_checksum_calculation",
  'request_checksum_calculation="when_required"', 'response_checksum_validation="when_required"',
  "multpart_threshold", "R2_TRANSFER_ERROR_CODE_SAFE"
):
  assert item.replace("multpart_threshold","multipart_threshold") in adapter, "R2 SDK safety guard missing"
assert 'if op == "delete"' in adapter and "litix-backup-probes/" in adapter

for part in (
    "ACTUAL_R2_CONNECTIVITY_PASS",
    "ACTUAL_ENCRYPTED_R2_BACKUP_PASS",
    "ACTUAL_ISOLATED_PG18_RESTORE_PASS",
    "ACTUAL_R2_BACKUP_BOTH_DBS_AND_RESTORES_PASS",
    'cmp -s "$encrypted" "$work/$db.download.age"',
    "sha256sum",
    "pg_restore -U postgres",
    "SCHEDULED_BOTH_DBS_READ_ONLY",
    "litix-private-backups",
):
    assert part in script, f"Required backup safeguard missing: {part}"
assert "SOURCE_CHECKPOINT_COUNTS_AS_NEON_BACKUP" not in script
print("R2_UPLOAD_COMPATIBILITY_STATIC_PASS; no credentials or production databases accessed")
