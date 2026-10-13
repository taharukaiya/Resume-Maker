#!/usr/bin/env bash
# Run on the VPS from any directory. The brief pause makes DB/files consistent.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
exec 9>/var/lock/brilliancy-backup.lock
flock -n 9 || { printf 'Another backup is running.\n'; exit 1; }
target="/var/backups/brilliancy/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$target"
trap 'docker compose up -d web worker caddy' EXIT
docker compose stop caddy web worker
docker compose exec -T db pg_dump -U postgres -d brilliancy -Fc > "$target/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar web -C /data -czf - . > "$target/files.tar.gz"
docker compose run --rm --no-deps -T --entrypoint tar caddy -C /data -czf - . > "$target/certificates.tar.gz"
tar -czf "$target/config.tar.gz" .env Caddyfile domains
sha256sum "$target"/* > "$target/SHA256SUMS"
printf 'Backup saved to %s\nCopy it off the VPS using encrypted backup storage and test restoration.\n' "$target"
