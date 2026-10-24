#!/usr/bin/env bash
# Run on the VPS from any directory. The brief pause makes DB/files consistent.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
exec 9>/var/lock/brilliancy-backup.lock
flock -n 9 || { printf 'Another backup is running.\n'; exit 1; }
data_bytes=$(docker compose run --rm --no-deps -T --entrypoint du web -sb /data | awk '{print $1}')
db_bytes=$(docker compose exec -T db psql -U postgres -d brilliancy -Atc "SELECT pg_database_size('brilliancy')")
available=$(df -B1 --output=avail /var/backups | tail -n 1 | tr -d ' ')
[[ "$data_bytes" =~ ^[0-9]+$ && "$db_bytes" =~ ^[0-9]+$ && "$available" =~ ^[0-9]+$ ]]
(( available > data_bytes + db_bytes + 2 * 1024 * 1024 * 1024 )) || { printf 'Insufficient disk headroom for a safe backup.\n'; exit 1; }
target="/var/backups/brilliancy/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$target"
printf '%s %s\n' "$data_bytes" "$db_bytes" > "$target/SIZES"
# Resume exactly the existing containers; a backup must never deploy a new tag
# or start a service that the operator deliberately stopped.
mapfile -t running < <(docker compose ps --services --status running | grep -E '^(web|worker|caddy)$')
resume() { if ((${#running[@]})); then docker compose start "${running[@]}"; fi; }
trap resume EXIT
if ((${#running[@]})); then docker compose stop "${running[@]}"; fi
docker compose exec -T db pg_dump -U postgres -d brilliancy -Fc > "$target/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar web -C /data -czf - . > "$target/files.tar.gz"
docker compose run --rm --no-deps -T --entrypoint tar caddy -C /data -czf - . > "$target/certificates.tar.gz"
tar -czf "$target/config.tar.gz" .env compose.yaml compose.existing.yaml compose.easypanel.yaml Caddyfile Caddyfile.existing Caddyfile.easypanel domains
if [[ -f /etc/easypanel/traefik/config/brilliancy-host-routing.yaml ]]; then
  tar -czf "$target/studio-routing.tar.gz" -C /etc/easypanel/traefik/config brilliancy-host-routing.yaml
fi
sha256sum "$target"/* > "$target/SHA256SUMS"
touch "$target/COMPLETE"
printf 'Backup saved to %s\nCopy it off the VPS using encrypted backup storage and test restoration.\n' "$target"
