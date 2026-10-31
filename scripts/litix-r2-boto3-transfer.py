#!/usr/bin/env python3
"""R2-only S3 transport for the existing encrypted, read-only Litix backup.

The AWS CLI v2 auto-selects a streaming checksum/trailer upload shape that
some R2 accounts reject with PutObject/InvalidArgument. Boto3 is configured
to send only required checksums, without chunked payload signing.

This module NEVER dumps databases, handles plaintext customer data, logs
credentials, exports keys, deletes retained backups or modifies a Neon DB.
Secret values come only from the protected GitHub Actions job environment.
"""
import os
import re
import sys
from pathlib import Path

from boto3.session import Session
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from botocore.exceptions import ClientError

SAFE_KEY = re.compile(r"^[A-Za-z0-9._/-]{1,350}$")


def main() -> int:
    if len(sys.argv) not in (3, 4):
        print("R2_TRANSFER_REJECTED: invalid arguments", file=sys.stderr)
        return 2
    op, key = sys.argv[1:3]
    path = Path(sys.argv[3]) if len(sys.argv) == 4 else None
    if (op not in {"put", "upload", "head", "get", "delete"}
        or not SAFE_KEY.fullmatch(key) or ".." in key
        or not key.startswith(("litix-backup-probes/", "litix-production/"))
        or (op == "delete" and not key.startswith("litix-backup-probes/"))
        or ((op in {"put", "upload", "get"}) != bool(path))):
        print("R2_TRANSFER_REJECTED: unsafe scope", file=sys.stderr)
        return 2
    if op in {"put", "upload"} and (not path.is_file() or path.is_symlink()):
        print("R2_TRANSFER_REJECTED: file unavailable", file=sys.stderr)
        return 2
    if op == "upload" and not str(path).endswith(".pgcustom.age"):
        print("R2_TRANSFER_REJECTED: encrypted backup required", file=sys.stderr)
        return 2
    try:
        bucket = os.environ["R2_BUCKET"]
        assert bucket == "litix-private-backups"
        # Region "auto" and path-style S3 are documented R2 settings.
        client = Session().client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT"],
            region_name="auto",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path", "payload_signing_enabled": False},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
                retries={"mode": "standard", "max_attempts": 2},
                connect_timeout=15,
                read_timeout=120,
            ),
        )
        if op == "put":
            # Bytes, not a streaming wrapper: no AWS chunked/trailer checksum.
            body = path.read_bytes()
            assert len(body) == 128 and key.startswith("litix-backup-probes/")
            client.put_object(Bucket=bucket, Key=key, Body=body, ContentLength=len(body))
        elif op == "upload":
            transfer = TransferConfig(
                multipart_threshold=8 * 1024 * 1024,
                multipart_chunksize=8 * 1024 * 1024,
                max_concurrency=1,
                use_threads=False,
            )
            client.upload_file(str(path), bucket, key, Config=transfer)
        elif op == "head":
            print(int(client.head_object(Bucket=bucket, Key=key)["ContentLength"]))
        elif op == "get":
            if path.exists():
                raise ValueError("download destination already exists")
            # Keep the ciphertext on disk; never print contents.
            client.download_file(bucket, key, str(path))
        elif op == "delete":
            client.delete_object(Bucket=bucket, Key=key)
        return 0
    except ClientError as exc:
        error = (exc.response or {}).get("Error") or {}
        code = str(error.get("Code") or "UNCLASSIFIED")
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,50}", code):
            code = "UNCLASSIFIED"
        # No raw response, request, host, key, credentials or customer data.
        print("R2_TRANSFER_ERROR_CODE_SAFE=" + code, file=sys.stderr)
    except Exception as exc:
        print("R2_TRANSFER_ERROR_CLASS=" + type(exc).__name__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
