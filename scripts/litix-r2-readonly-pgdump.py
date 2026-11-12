#!/usr/bin/env python3
"""Read-only pg_dump 18 using PostgreSQL environment variables, not DSN arguments.

Never prints, logs, or writes the production Neon connection URL. The caller
verifies the exact main branch host and DB identity before invoking this helper.
Only accepts the URL from a private process environment on the ephemeral runner.
"""
from __future__ import annotations

import os
import subprocess
import sys
from urllib.parse import unquote, urlsplit, parse_qs

source = os.environ.get("LITIX_READONLY_PG_URL", "")
url = urlsplit(source)
if (
    url.scheme not in ("postgres", "postgresql")
    or not url.hostname
    or not url.username
    or not url.password
    or not url.path.startswith("/")
    or parse_qs(url.query).get("sslmode") != ["require"]
):
    print("DUMP_BLOCKED: source URL missing valid direct TLS settings", file=sys.stderr)
    sys.exit(2)

pg = {
    "PGHOST": url.hostname,
    "PGPORT": str(url.port or 5432),
    "PGUSER": unquote(url.username),
    "PGPASSWORD": unquote(url.password),
    "PGDATABASE": url.path[1:],
    "PGSSLMODE": "require",
    "PGCONNECT_TIMEOUT": "20",
    "PGAPPNAME": "litix_read_only_backup",
}
if pg["PGDATABASE"] not in ("neondb", "litixapi"):
    print("DUMP_BLOCKED: unapproved database", file=sys.stderr)
    sys.exit(2)

# Docker CLI forwards environment values by NAME; no password or DSN in argv.
env = os.environ.copy()
env.update(pg)
cmd = ["docker", "run", "--rm", "--network", "host"]
for key in pg:
    cmd += ["-e", key]
cmd += ["postgres:18-alpine", "pg_dump", "--format=custom",
        "--no-owner", "--no-acl", "--compress=6"]

try:
    result = subprocess.run(
        cmd, env=env, stdin=subprocess.DEVNULL, stdout=sys.stdout.buffer,
        stderr=subprocess.DEVNULL, check=False
    )
except OSError:
    print("DUMP_BLOCKED: PostgreSQL 18 utility container unavailable", file=sys.stderr)
    sys.exit(2)
if result.returncode != 0:
    print("DUMP_BLOCKED: source PostgreSQL pg_dump failed", file=sys.stderr)
    sys.exit(2)
