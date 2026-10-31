#!/usr/bin/env python3
"""Static, secrets-free regression checks. Does not contact Cloudflare or Neon."""
from pathlib import Path
script = Path(__file__).with_name("litix-r2-github-manual-verify.sh").read_text()
assert "--checksum-algorithm" not in script, "Optional S3 checksum headers must not be sent to R2 uploads"
assert "AWS_REQUEST_CHECKSUM_CALCULATION=when_required" in script
assert "AWS_RESPONSE_CHECKSUM_VALIDATION=when_required" in script
assert 's3api put-object' in script and 's3 cp "$encrypted"' in script
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
