#!/usr/bin/env bash
# Upload only an already-consistent backup. Never stops or starts applications.
set -euo pipefail
umask 077
cd "$(dirname "$0")"
[[ $EUID == 0 ]] || { echo 'Run as root with private backup configuration.'; exit 1; }
config=/etc/brilliancy-backup.env
[[ -f "$config" && ! -L "$config" && $(stat -c '%u:%a' "$config") == 0:600 ]] || { echo 'Backup configuration must be root-owned mode 600.'; exit 1; }
set -a
source "$config"
set +a
: "${RESTIC_REPOSITORY:?Set the private S3 repository}"
: "${RESTIC_PASSWORD_FILE:?Set the encryption password file}"
[[ "$RESTIC_REPOSITORY" == s3:https://*/* ]] || { echo 'Use an HTTPS S3 endpoint and bucket.'; exit 1; }
[[ -f "$RESTIC_PASSWORD_FILE" && ! -L "$RESTIC_PASSWORD_FILE" && $(stat -c '%u:%a' "$RESTIC_PASSWORD_FILE") == 0:600 ]] || { echo 'Encryption password must be root-owned mode 600.'; exit 1; }
command -v restic >/dev/null
exec 9>/var/lock/brilliancy-offsite-backup.lock
flock -n 9 || { echo 'Another off-server backup is running.'; exit 1; }
export RESTIC_CACHE_DIR=/var/cache/brilliancy-restic
mkdir -p /var/lib/brilliancy-backup "$RESTIC_CACHE_DIR"
chmod 700 /var/lib/brilliancy-backup "$RESTIC_CACHE_DIR"
if [[ ${1:-} == --init ]]; then
  # Explicit one-time action; never initialize a replacement repository on failure.
  restic init
  exit
fi
[[ $# == 0 ]] || { echo 'Usage: offsite-backup.sh [--init]'; exit 1; }
backup=$(find /var/backups/brilliancy -mindepth 2 -maxdepth 2 -name COMPLETE -type f -printf '%h\n' | sort | tail -n 1)
[[ "$backup" =~ ^/var/backups/brilliancy/[0-9]{8}T[0-9]{6}Z$ ]] || { echo 'No completed local backup.'; exit 1; }
age=$(( $(date +%s) - $(stat -c %Y "$backup/COMPLETE") ))
(( age >= 0 && age <= 30 * 3600 )) || { echo 'Local backup is stale; off-server success will not be recorded.'; exit 1; }
python3 verify-backup-files.py "$backup"
log=$(mktemp /var/lib/brilliancy-backup/upload.XXXXXXXX)
trap 'rm -f -- "$log"' EXIT
restic --limit-upload 1024 backup --host brilliancy-platform --tag consistent-platform --json "$backup" > "$log"
snapshot=$(python3 - "$log" <<'PY'
import json,re,sys
rows=[json.loads(line) for line in open(sys.argv[1])]
ids=[r['snapshot_id'] for r in rows if r.get('message_type')=='summary']
assert len(ids)==1 and re.fullmatch(r'[a-f0-9]{8,64}',ids[0]), 'Missing successful snapshot'
print(ids[0])
PY
)
restic check
printf '%s\n%s\n%s\n' "$snapshot" "$(basename "$backup")" "$(date -u +%FT%TZ)" > /var/lib/brilliancy-backup/last-success.tmp
mv /var/lib/brilliancy-backup/last-success.tmp /var/lib/brilliancy-backup/last-success
echo "Encrypted off-server snapshot verified: $snapshot"
# No automatic forget/prune or local deletion: retention needs explicit approval.
