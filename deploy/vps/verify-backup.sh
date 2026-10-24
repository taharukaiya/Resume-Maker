#!/usr/bin/env bash
# Restore only into a disposable PostgreSQL container and temporary directory.
# Never loads backed-up environment variables or modifies live Docker volumes.
set -euo pipefail
backup=$(realpath -e "${1:?Pass an existing backup directory}")
case "$backup" in /var/backups/brilliancy/*) ;; *) printf 'Unexpected backup location.\n'; exit 1;; esac
for file in database.dump files.tar.gz config.tar.gz certificates.tar.gz SHA256SUMS; do test -s "$backup/$file"; done
(cd "$backup" && sha256sum -c SHA256SUMS)
python3 - "$backup" <<'PY'
import pathlib, shutil, sys, tarfile
root = pathlib.Path(sys.argv[1])
with tarfile.open(root / 'files.tar.gz', 'r:gz') as archive:
    needed = sum(item.size for item in archive)
sizes = root / 'SIZES'
database = int(sizes.read_text().split()[1]) if sizes.exists() else (root / 'database.dump').stat().st_size * 20
if shutil.disk_usage('/var/tmp').free < needed + database * 2 + 2 * 1024**3:
    raise SystemExit('Insufficient disk headroom for safe restoration testing')
PY
scratch=$(mktemp -d /var/tmp/brilliancy-restore-check.XXXXXXXX)
name="brilliancy-restore-check-$(basename "$scratch" | tr '[:upper:]' '[:lower:]')"
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  case "$scratch" in /var/tmp/brilliancy-restore-check.*) rm -rf -- "$scratch";; esac
}
trap cleanup EXIT
chmod 700 "$scratch"
mkdir "$scratch/files" "$scratch/pgdata"
python3 - "$backup/files.tar.gz" "$scratch/files" <<'PY'
import sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    archive.extractall(sys.argv[2], filter='data')
PY
docker run -d --name "$name" --network none --memory=384m --cpus=0.25 \
  --mount "type=bind,src=$scratch/pgdata,dst=/var/lib/postgresql/data" \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-bookworm >/dev/null
for attempt in {1..30}; do
  if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$name" createdb -U postgres restore_verify
docker exec -i "$name" pg_restore -U postgres --exit-on-error --no-owner --no-privileges -d restore_verify < "$backup/database.dump"
docker exec "$name" psql -U postgres -d restore_verify -Atc \
  "SELECT storage_key FROM media UNION SELECT r.value->>'key' FROM releases CROSS JOIN LATERAL jsonb_each(manifest->'routes') r;" > "$scratch/keys"
python3 - "$scratch/files/storage" "$scratch/keys" <<'PY'
import pathlib, sys
root = pathlib.Path(sys.argv[1]).resolve()
keys = pathlib.Path(sys.argv[2]).read_text().splitlines()
for key in keys:
    item = (root / key).resolve()
    if not item.is_relative_to(root) or not item.is_file():
        raise SystemExit('FAIL: a restored database asset is missing or outside storage')
print(f'PASS: restored database and all {len(keys)} referenced private/public files')
PY
printf 'PASS: isolated restoration completed; live services were not changed.\n'
