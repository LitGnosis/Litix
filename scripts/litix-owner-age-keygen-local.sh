#!/usr/bin/env bash
# Run ON THE OWNER'S TRUSTED COMPUTER. Never generate a real private key in
# ChatGPT, a public GitHub Action, Vercel or a cloud/shared shell.
set -euo pipefail
umask 077
fail(){ printf 'LITIX_KEY_SETUP_BLOCKED: %s\n' "$*" >&2; exit 2; }
command -v age-keygen >/dev/null 2>&1 || fail "Install age locally before generating an owner key."
: "${HOME:?Owner HOME directory required}"
directory="${LITIX_LOCAL_KEY_DIR:-$HOME/.config/litix-backup}"
[[ "$directory" == /* ]] || fail "Key storage directory must be an absolute path."
[[ ! -L "$directory" ]] || fail "Symlinked key directory is prohibited."
mkdir -p -m 700 -- "$directory"
chmod 700 -- "$directory"
directory="$(cd -P -- "$directory" && pwd)"
if command -v git >/dev/null 2>&1 && git -C "$directory" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Private identity must never be generated inside a Git repository."
fi
identity="$directory/litix-r2-age-identity.txt"
[[ ! -e "$identity" && ! -L "$identity" ]] || fail "Identity already exists. NEVER overwrite the private recovery key."
age-keygen -o "$identity" >/dev/null
chmod 600 "$identity"
public="$(age-keygen -y "$identity")"
[[ "$public" == age1* ]] || fail "Identity generated but public recipient validation failed."
printf '%s\n' "LITIX_AGE_KEY_CREATED_LOCALLY" "PRIVATE_FILE_LOCATION=$identity" \
  "PUBLIC_AGE_RECIPIENT=$public" \
  "Keep the private file OFF ChatGPT, GitHub, Vercel and Cloudflare R2." \
  "Save one independent OFFLINE copy of the private identity in an encrypted, owner-controlled location." \
  "Use only PUBLIC_AGE_RECIPIENT when encrypting real backups."
