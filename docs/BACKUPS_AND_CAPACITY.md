# Backups and capacity preparation

Verified 24 October 2026. **No portfolio migrations are authorized yet.** Off-server storage selection was explicitly deferred by the owner; the offsite timer is not installed or enabled and no cloud backup is claimed.

## Existing-site repair

`www.researchbyshaila.com` resolved to the correct VPS but had no matching legacy HTTPS router. It returned the self-signed EasyPanel fallback certificate. The root address already worked. Added an exact-host HTTP/HTTPS redirect to its existing root, using the existing `education_web-master-2` service and Let's Encrypt resolver. No DNS, content, application container, studio route or legacy backend was changed.

The expanded audit found the same missing-www issue on Shiba, Layla, Rubayet and Raisa. These now have the same narrowly scoped redirect, using their existing legacy service references. Root and www checks passed for **58/58 addresses**. Earlier reports of 29 successful checks covered roots only and did not prove www was healthy. There is no earlier www check establishing when the missing configuration began.

Owned repair files on the VPS:

- `/etc/easypanel/traefik/config/shaila-www-repair.yaml`
- `/etc/easypanel/traefik/config/legacy-www-repairs.yaml`

Generated EasyPanel `main.yaml` remains untouched. The next consistent platform backup includes these repair files in `legacy-www-routing.tar.gz`. To roll back only these additive repairs, move those two files outside Traefik's watched directory; this would reintroduce the www outage. Do not remove shared proxy configuration. When eventually migrating one reviewed domain, remove its corresponding legacy redirect as part of that domain's planned cutover to www canonical URLs.

Run the bounded audit with `python scripts/check-migration-hosts.py`. It now checks root and www and returns nonzero if any certificate/request fails.

## Prepare encrypted off-server backups

The setup uses Restic with an HTTPS S3-compatible private bucket. Restic encrypts before upload. Backblaze documents the [S3-compatible Restic integration](https://www.backblaze.com/docs/cloud-storage-integrate-restic-with-backblaze-b2); other compatible providers can be configured after checking their endpoint and credential requirements. Nothing is purchased or provisioned by these scripts.

The upload job reads only a completed consistent local backup. It never stops, starts or deploys websites. It rejects incomplete, corrupt or older-than-30-hour backups, limits uploads to 1 MiB/s, uses a separate lock and records success only after upload and repository metadata verification. The service limits CPU to 25% of one core and memory to 512 MiB. A failed job leaves existing backups intact. It does not delete snapshots or local backups.

When storage has been chosen:

1. Create a **private, dedicated backup bucket**, isolated from public website assets. Give a backup-only credential access to that bucket/prefix, not the entire storage account. Normal Restic operation needs read/list/write and lock deletion. Object lock or append-only policies need a provider-specific compatibility test; do not enable a blanket retention policy that traps Restic locks. Keep a separately controlled immutable copy if compromised-server deletion protection is required.
2. Install Restic from Ubuntu's trusted repository (`apt-get install restic`). Create a long random encryption password in `/etc/brilliancy-backup.password`, owned by root, mode 600. Save the password and recovery instructions in the owner's password manager **outside this VPS**. Losing that password makes recovery impossible. Never commit it or paste it into chat.
3. Create root-owned mode-600 `/etc/brilliancy-backup.env` using the following names (also documented in `.env.example`). Enter real credentials privately on the server. Do not put these in the web application environment:

```sh
RESTIC_REPOSITORY=s3:https://YOUR-S3-ENDPOINT/YOUR-PRIVATE-BUCKET/brilliancy
RESTIC_PASSWORD_FILE=/etc/brilliancy-backup.password
AWS_ACCESS_KEY_ID=YOUR-BUCKET-SCOPED-KEY
AWS_SECRET_ACCESS_KEY=YOUR-BUCKET-SCOPED-SECRET
AWS_DEFAULT_REGION=YOUR-PROVIDER-REGION
```

4. Prepare service directories, initialize the repository **once**, and perform the first upload. Do not reinitialize when an existing repository cannot be reached:

```sh
install -d -m 700 /var/cache/brilliancy-restic /var/lib/brilliancy-backup
cd /opt/brilliancy/deploy/vps
bash offsite-backup.sh --init
bash offsite-backup.sh
```

5. Perform the restore drill below before enabling the timer. Then install the checked-in service/timer into `/etc/systemd/system`, run `systemctl daemon-reload`, and `systemctl enable --now brilliancy-offsite-backup.timer`. It runs at 21:15 UTC / 03:15 Dhaka, after the local backup schedule. Review `systemctl status brilliancy-offsite-backup.service`, its journal and `/var/lib/brilliancy-backup/last-success`. Alert on a failed job or a success older than 30 hours through an approved monitoring destination; no notification destination is configured yet.

### Restore drill after the bucket is connected

Run as root. These commands restore into a new isolated directory, not live volumes. Choose sufficient free disk before downloading. The final validator also checks expansion headroom and restores the database into a disposable, network-isolated PostgreSQL container.

```sh
set -a
source /etc/brilliancy-backup.env
set +a
snapshot=$(sed -n '1p' /var/lib/brilliancy-backup/last-success)
backup_name=$(sed -n '2p' /var/lib/brilliancy-backup/last-success)
restore_dir=$(mktemp -d /var/tmp/brilliancy-offsite-restore.XXXXXXXX)
restic check --read-data
restic restore "$snapshot" --target "$restore_dir"
bash /opt/brilliancy/deploy/vps/verify-backup.sh "$restore_dir/var/backups/brilliancy/$backup_name"
```

Record the snapshot, duration, checksums and restore result privately. After reviewing success, remove only that exact temporary restore directory. Do not extract configuration over a running installation. A complete disaster-recovery rehearsal must separately verify configuration, credentials, proxy rules and application startup on a fresh machine.

The checksum validator now resolves manifest filenames **inside the supplied restored backup**. Tests prove that corrupt restored bytes fail even when original files still pass, and that restoration succeeds after originals are removed. Six manifest regression tests passed. A real Restic 0.19.1 local synthetic round trip passed encryption, full data checking, wrong-password rejection and restored-file verification. This validates the tool/verification workflow; **S3 transfer and full remote recovery remain untested until a bucket is connected**.

### Retention and coverage limits

The existing backup creates full compressed archives. Do not assume Restic will deduplicate these as efficiently as individual original files. Budget full changed archives until measurements establish actual deduplication. Keep retention deletion disabled until the owner approves a policy (a starting proposal is 7 daily, 4 weekly and 3 monthly recovery points). Configure cost alerts and measure local backup growth; the existing disk-headroom guard fails a new backup rather than filling the shared disk. At the requested scale, redesign consistent file snapshots/incremental backup capture before onboarding all portfolios; pausing the new studio to archive hundreds of GB is not acceptable as a long-term nightly process.

This protects the **new Brilliancy platform**, including originals, database, published assets, configuration and its owned route files. It does not establish backup/restore coverage for the separate legacy applications. Those require their own consistent export and recovery plan before migration.

## Capacity evidence: 400 portfolios / 88,000 articles

Reproduce with `node --max-old-space-size=3072 --import tsx scripts/capacity-local.ts --isolated` from a clean environment without cloud/database credentials. The script creates a unique `.test-data/capacity-*` directory, uses embedded PostgreSQL and actual application API handlers and publication worker, and does not read `.env`. No VPS traffic or production writes are generated. Test data is retained locally for inspection; it is not committed.

Local baseline: Windows, Intel i5-10500T, 12 logical processors, 8 GiB RAM. Synthetic articles contain five headings, twenty paragraphs and an abstract. Each 220-article draft was 3,706,325 bytes. Results:

| Operation                      | Workload                              | Result                                |
| ------------------------------ | ------------------------------------- | ------------------------------------- |
| Dataset                        | 400 × 220 articles                    | 88,000 entries; seed 48 seconds       |
| List portfolios                | 80 calls, concurrency 4               | p95 61 ms                             |
| Open editor                    | 40 calls, concurrency 4               | p95 276 ms                            |
| Save complete draft            | 8 calls, concurrency 2                | p95 684 ms; drafts stayed unpublished |
| Publish one complete portfolio | 220 article PDFs, serial worker       | 66.9 seconds; job completed           |
| Validate generated release     | 672 files, concurrency 4              | Every file readable; 44,603,794 bytes |
| Process memory                 | Whole run including embedded database | sampled peak RSS about 1,014 MiB      |

This is an in-process functional/scaling baseline, **not an HTTP throughput benchmark or a promise of 400 simultaneous users**. The dataset does not contain 88,000 real uploaded files or images. The current shared two-core VPS has a different CPU/storage/resource budget. The previous isolated production-PostgreSQL listing check measured p95 854 ms at concurrency 4; these are different workloads and cannot be compared as an optimization claim.

## Storage and next capacity gate

For 200 articles per portfolio, **original files alone** occupy the following approximate decimal GB, before extracted figures, generated PDFs, HTML, release history, database revisions, backups and free-space reserve:

| Average original | 300 portfolios / 60,000 articles | 400 portfolios / 80,000 articles |
| ---------------- | -------------------------------- | -------------------------------- |
| 1 MB             | 60 GB                            | 80 GB                            |
| 2 MB             | 120 GB                           | 160 GB                           |
| 5 MB             | 300 GB                           | 400 GB                           |

At 220 articles and 400 portfolios, multiply average file MB by 88 for original-file GB. The synthetic text-only release measured about 44.6 MB per portfolio; real images can substantially increase that. Current free VPS disk was approximately 61 GiB, so **do not onboard the full target onto this disk**. The 100 MB default media quota is also too small for most 200-article portfolios. Leave it unchanged until storage and retention are budgeted; removing an upload is recoverable and does not reclaim bytes.

Next test on dedicated staging hardware with the intended production resource limits: use representative permission-cleared PDFs/DOCX/images, seed 300 then 400 portfolios, and run mixed public browsing, editor saves, uploads/extraction and publication at explicit concurrency levels. Measure HTTP p95/p99, errors, queue wait, extraction/provider failures, CPU, memory, disk growth and backup/restore duration. Include a failed worker and a restore drill. Do not stress the shared live VPS. Approve a hosting/storage plan only after that evidence and an agreed expected visitor/editor workload; account count alone does not determine traffic capacity.

The current live sample contains only four PDFs (mean 159,688 bytes, largest 188,420 bytes) and three WebP images (mean 34,699 bytes). This small text-heavy sample cannot establish the expected size of 80,000 future uploads; retain the scenario table until representative papers and image counts are supplied.
