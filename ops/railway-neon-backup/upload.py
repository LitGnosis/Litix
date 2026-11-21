#!/usr/bin/env python3
"""Write-once, private, full custom-format backups of the three original Neon databases.

No live order table is modified. Each manifest is written LAST, after every
source dump is validated and uploaded with a recorded SHA-256 digest.
"""
import hashlib
import json
import os
import pathlib
import sys
from datetime import datetime, timezone
from botocore.exceptions import ClientError
from botocore.config import Config
import boto3

REQUIRED = ("neondb", "litixapi", "litgnosis_platform")
PREFIX = "neon-source-fancy-wave-75069167/first-full-export"
MARKER = PREFIX + "/complete.json"


def client():
    required = [
        "S3_ENDPOINT", "S3_BUCKET", "S3_REGION",
        "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
    ]
    absent = [k for k in required if not os.environ.get(k)]
    if absent:
        raise RuntimeError("Private backup storage not configured: " + ",".join(absent))
    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT"],
        region_name=os.environ["S3_REGION"],
        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


def marker_exists(s3):
    try:
        response = s3.get_object(Bucket=os.environ["S3_BUCKET"], Key=MARKER)
        marker = json.loads(response["Body"].read(65536))
        if marker.get("status") != "complete" or sorted(marker.get("databases", [])) != sorted(REQUIRED):
            raise RuntimeError("Unexpected backup marker; refusing to overwrite anything")
        return True
    except ClientError as error:
        status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        code = error.response.get("Error", {}).get("Code", "")
        if status == 404 or code in ("NoSuchKey", "NotFound", "404"):
            return False
        raise


def upload(s3, directory):
    if marker_exists(s3):
        print("Backup already marked complete; no overwrite performed")
        return
    manifest = {
        "status": "preparing",
        "sourceProjectId": "fancy-wave-75069167",
        "sourceBranchId": "br-long-term-awmdp29b",
        "format": "pg_dump custom",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "databases": {},
    }
    for db in REQUIRED:
        path = directory / (db + ".dump")
        if not path.is_file() or path.stat().st_size < 2000:
            raise RuntimeError("Missing or suspiciously small archive: " + db)
        digest = hashlib.sha256()
        with path.open("rb") as fh:
            for block in iter(lambda: fh.read(1024 * 1024), b""):
                digest.update(block)
        checksum = digest.hexdigest()
        key = PREFIX + "/" + db + ".dump"
        s3.upload_file(
            str(path), os.environ["S3_BUCKET"], key,
            ExtraArgs={
                "ContentType": "application/octet-stream",
                "Metadata": {"sha256": checksum, "source-db": db},
            },
        )
        obj = s3.head_object(Bucket=os.environ["S3_BUCKET"], Key=key)
        if obj.get("ContentLength") != path.stat().st_size:
            raise RuntimeError("Remote byte length mismatch: " + db)
        if obj.get("Metadata", {}).get("sha256") != checksum:
            raise RuntimeError("Remote checksum metadata mismatch: " + db)
        manifest["databases"][db] = {"key": key, "sha256": checksum, "bytes": path.stat().st_size}
        print(json.dumps({"db": db, "status": "archived_private", "bytes": path.stat().st_size}))
    manifest["status"] = "complete"
    complete = {
        "status": "complete",
        "databases": list(REQUIRED),
        "manifestKey": PREFIX + "/manifest.json",
        "capturedAt": manifest["capturedAt"],
    }
    s3.put_object(
        Bucket=os.environ["S3_BUCKET"],
        Key=PREFIX + "/manifest.json",
        Body=json.dumps(manifest, separators=(",", ":")).encode(),
        ContentType="application/json",
    )
    s3.put_object(
        Bucket=os.environ["S3_BUCKET"],
        Key=MARKER,
        Body=json.dumps(complete, separators=(",", ":")).encode(),
        ContentType="application/json",
    )
    print(json.dumps({"status": "complete", "databases": list(REQUIRED), "marker": MARKER}))


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    s3 = client()
    if action == "check":
        print("COMPLETE" if marker_exists(s3) else "INCOMPLETE")
    elif action == "upload" and len(sys.argv) == 3:
        upload(s3, pathlib.Path(sys.argv[2]))
    else:
        raise SystemExit("Usage: upload.py check | upload.py upload /path/to/dumps")


if __name__ == "__main__":
    main()
