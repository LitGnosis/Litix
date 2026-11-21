#!/usr/bin/env python3
"""One-time, no-drop restore of verified Neon archives into isolated Railway DBs.

Never touches the Railway application database, DNS, payments, or dispatch.
"""
import hashlib, json, os, pathlib, subprocess, tempfile, urllib.parse
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

PREFIX = "neon-source-fancy-wave-75069167/first-full-export"
DB_NAMES = {
    "neondb": "neon_neondb_recovery",
    "litixapi": "neon_litixapi_recovery",
    "litgnosis_platform": "neon_litgnosis_platform_recovery",
}

def storage():
    fields = ["S3_ENDPOINT", "S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]
    if any(not os.getenv(k) for k in fields):
        raise RuntimeError("private archive storage variables missing")
    return boto3.client(
        "s3", endpoint_url=os.environ["S3_ENDPOINT"],
        region_name=os.environ["S3_REGION"], aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )

def get_json(s3, name):
    try:
        r = s3.get_object(Bucket=os.environ["S3_BUCKET"], Key=PREFIX + "/" + name)
        return json.loads(r["Body"].read(65536))
    except ClientError as exc:
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        code = exc.response.get("Error", {}).get("Code")
        if status == 404 or code in ("NoSuchKey", "404", "NotFound"):
            return None
        raise

def pg_env(target_db):
    raw = os.environ.get("RAILWAY_TARGET_DATABASE_URL", "")
    parsed = urllib.parse.urlsplit(raw)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or not parsed.username or not parsed.path:
        raise RuntimeError("target Postgres URL invalid")
    if not parsed.path.strip("/") or parsed.path.strip("/") in DB_NAMES.values():
        raise RuntimeError("refusing to use a recovery database as admin target")
    env = os.environ.copy()
    env.update({
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port or 5432),
        "PGUSER": urllib.parse.unquote(parsed.username),
        "PGPASSWORD": urllib.parse.unquote(parsed.password or ""),
        "PGDATABASE": target_db,
        "PGCONNECT_TIMEOUT": "15",
        "PGOPTIONS": "-c statement_timeout=120000",
    })
    # Internal Railway Postgres can run on a private socket or TLS; do not force Neon-only SSL.
    env.pop("DATABASE_URL", None)
    return env, parsed.path.lstrip("/")

def sql(query, db, *, timeout=45):
    env, _ = pg_env(db)
    process = subprocess.run(
        ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", query],
        env=env, capture_output=True, text=True, timeout=timeout,
    )
    if process.returncode:
        raise RuntimeError("Postgres SQL check failed (contents redacted)")
    return process.stdout.strip()

def safe_manifest(s3, folder):
    complete = get_json(s3, "complete.json")
    manifest = get_json(s3, "manifest.json")
    if not complete or not manifest or complete.get("status") != "complete" or manifest.get("status") != "complete":
        print("source_archive_incomplete; no Railway database modifications")
        return None
    if sorted(complete.get("databases", [])) != sorted(DB_NAMES):
        raise RuntimeError("unexpected completion marker database list")
    if set(manifest.get("databases", {})) != set(DB_NAMES):
        raise RuntimeError("unexpected manifest database list")
    verified = {}
    for source in DB_NAMES:
        row = manifest["databases"][source]
        key = row.get("key")
        digest = row.get("sha256")
        size = row.get("bytes")
        if key != PREFIX + "/" + source + ".dump" or not isinstance(digest, str) or len(digest) != 64:
            raise RuntimeError("unexpected archive manifest entry: " + source)
        if not isinstance(size, int) or size < 2000:
            raise RuntimeError("invalid archive length: " + source)
        target = folder / (source + ".dump")
        s3.download_file(os.environ["S3_BUCKET"], key, str(target))
        if target.stat().st_size != size:
            raise RuntimeError("archive length mismatch: " + source)
        sha = hashlib.sha256(target.read_bytes()).hexdigest()
        if sha != digest:
            raise RuntimeError("archive SHA-256 mismatch: " + source)
        x = subprocess.run(["pg_restore", "--list", str(target)],capture_output=True,timeout=45)
        if x.returncode:
            raise RuntimeError("pg_restore integrity check failed: " + source)
        verified[source] = (target, sha)
    return verified

def target_state(name, admin_db):
    present = sql(
        "SELECT 1 FROM pg_database WHERE datname = '" + name + "' LIMIT 1;",
        admin_db,
    ) == "1"
    if not present:
        return "absent"
    try:
        table = sql("SELECT to_regclass('migration_intake.completed');", name)
    except Exception:
        raise RuntimeError("recovery database exists but cannot be safely inspected: " + name)
    if table != "migration_intake.completed":
        raise RuntimeError("recovery database exists without completion marker; manual review required: " + name)
    return "complete"

def restore_one(source, target, dump, checksum, admin_db):
    state = target_state(target, admin_db)
    if state == "complete":
        saved = sql("SELECT sha256 FROM migration_intake.completed LIMIT 1;", target)
        if saved != checksum:
            raise RuntimeError("different archive already restored; manual review required: " + target)
        print(json.dumps({"source": source, "status": "previously_verified"}))
        return
    # Identifiers are fixed constants above, not user-controlled.
    sql("CREATE DATABASE " + target + ";", admin_db)
    env, _ = pg_env(target)
    process = subprocess.run(
        ["pg_restore", "--no-owner", "--no-acl", "--exit-on-error", "--dbname", target, str(dump)],
        env=env, capture_output=True, timeout=1800,
    )
    if process.returncode:
        raise RuntimeError("staging restore failed for " + target + "; left for manual inspection, no retry/overwrite")
    sql("CREATE SCHEMA IF NOT EXISTS migration_intake;", target)
    sql("CREATE TABLE migration_intake.completed(sha256 text primary key, source_name text not null, verified_at timestamptz default now());", target)
    sql("INSERT INTO migration_intake.completed(sha256,source_name) VALUES ('" + checksum + "','" + source + "');", target)
    print(json.dumps({"source": source, "status": "restored_into_isolated_railway_database", "tables": sql("SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');",target)}))

def main():
    if os.getenv("RAILWAY_RECOVERY_STAGING_ONLY") != "true":
        raise RuntimeError("staging-only release flag must be true")
    s3 = storage()
    with tempfile.TemporaryDirectory(prefix="neon-staging-") as d:
        verified = safe_manifest(s3, pathlib.Path(d))
        if verified is None:
            return
        _, admin_db = pg_env("railway")
        # Always preflight all sources BEFORE writing the first target database.
        states = {source:target_state(target, admin_db) for source, target in DB_NAMES.items()}
        print(json.dumps({"status": "all_source_archives_verified", "targetStates":states}))
        for source, target in DB_NAMES.items():
            dump, checksum = verified[source]
            restore_one(source,target,dump,checksum,admin_db)
    print("staging_only_restore_completed; production checkout and worker dispatch unchanged")

if __name__ == "__main__":
    main()
