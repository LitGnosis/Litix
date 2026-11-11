#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  printf 'Usage: sudo LITIX_APPROVED_WHEELHOUSE=/absolute/reviewed/wheels %s --apply /absolute/reviewed/source\n' "$0" >&2
  exit 2
}

[[ "${1:-}" == "--apply" ]] || usage
[[ "$#" == 2 && "${2:-}" == /* ]] || usage
[[ "$EUID" -eq 0 ]] || { echo "Run only on your explicitly authorized Linux worker host with sudo." >&2; exit 1; }

source_dir="$2"
wheelhouse="${LITIX_APPROVED_WHEELHOUSE:-}"
[[ "$wheelhouse" == /* && -d "$wheelhouse" ]] || { echo "Approved offline wheelhouse required. No global pip installs performed." >&2; exit 1; }
[[ -f "$source_dir/requirements.txt" && -f "$source_dir/litix_reliability/telemetry_worker.py" &&
   -f "$source_dir/litix_reliability/preflight.py" && -f "$source_dir/deploy/litix-telemetry.service" ]] ||
  { echo "Reviewed first-party reliability source tree missing." >&2; exit 1; }
[[ -z "$(find "$source_dir/litix_reliability" -type l -print -quit)" ]] ||
  { echo "Refusing symbolic links in reviewed source tree." >&2; exit 1; }

for unit in litix-telemetry.service litix-webhooks.service; do
  if systemctl is-active --quiet "$unit"; then
    echo "Refusing to replace files while $unit is active; use reviewed rolling-release workflow." >&2
    exit 1
  fi
done
if [[ -e /opt/litix/reliability/litix_reliability ]]; then
  echo "Existing release detected. Use a separately reviewed, versioned upgrade and rollback plan." >&2
  exit 1
fi

getent group litix >/dev/null || groupadd --system litix
id -u litix >/dev/null 2>&1 || useradd --system --gid litix --home-dir /var/lib/litix --shell /usr/sbin/nologin litix

dest=/opt/litix/reliability
install -d -o root -g litix -m 0750 /opt/litix "$dest" /etc/litix
install -d -o litix -g litix -m 0700 /var/lib/litix

# A reviewable source copy only; do not copy unknown .env or account cookies.
cp -R -- "$source_dir/litix_reliability" "$dest/litix_reliability"
find "$dest/litix_reliability" -type d -exec chmod 0750 {} +
find "$dest/litix_reliability" -type f -exec chmod 0640 {} +
chown -R root:litix "$dest/litix_reliability"
install -o root -g litix -m 0640 "$source_dir/requirements.txt" "$dest/requirements.txt"

# System packages and virtual environment are managed on the dedicated host.
# Install dependencies ONLY from a previously vetted local wheelhouse.
if [[ ! -x "$dest/.venv/bin/python" ]]; then
  python3 -m venv "$dest/.venv"
fi
"$dest/.venv/bin/python" -m pip install --no-index --find-links="$wheelhouse" -r "$dest/requirements.txt"
"$dest/.venv/bin/python" -c 'import asyncpg, httpx, redis'

install -o root -g root -m 0644 "$source_dir/deploy/litix-telemetry.service" /etc/systemd/system/litix-telemetry.service
install -o root -g root -m 0644 "$source_dir/deploy/litix-webhooks.service" /etc/systemd/system/litix-webhooks.service

if [[ ! -f /etc/litix/reliability.env ]]; then
  install -o root -g litix -m 0640 "$source_dir/deploy/reliability.env.example" /etc/litix/reliability.env
fi
chown root:litix /etc/litix/reliability.env
chmod 0640 /etc/litix/reliability.env

systemctl daemon-reload
echo "Installed safely. Neither service was enabled or started."
echo "Configure approved secrets and run the preflight and no-charge tests before systemctl enable --now."
