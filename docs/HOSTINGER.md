# Hostinger evaluation and capacity plan

Checked 11 October 2026. The account's purchased plan must be verified in hPanel before deploying or buying anything. No deployment is confirmed by this document.

## Hosting without cPanel

Use a Hostinger VPS with Docker Compose and an HTTPS reverse proxy. Hostinger's Docker Manager can manage containers; no cPanel license or custom hosting-control-panel development is needed. If a richer deployment dashboard is wanted, Hostinger also offers a Coolify template. Choose one management approach rather than installing competing proxies/panels.

The portfolio admin panel manages researchers, content, permissions and publishing. The server management interface manages containers, databases and logs. Clients should never receive server-management access.

Business and Cloud hosting now support managed Node.js applications too, including Next.js. An existing eligible plan may support a small test with an external PostgreSQL database. This is different from a VPS: verify database connectivity, worker lifecycle and plan limits before selecting that route. A VPS gives control over PostgreSQL, workers and antivirus services required for the later full deployment.

Sources: [Node.js options](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/), [Docker Manager](https://www.hostinger.com/support/12040815-how-to-deploy-your-first-container-with-hostinger-docker-manager/), [Coolify template](https://www.hostinger.com/support/9615197-how-to-use-the-coolify-vps-template-at-hostinger/).

## Capacity for 400 portfolios

Assume one portfolio per user and every portfolio reaches its current 100 MiB original-media quota. This is about 104.9 MB in decimal units. It is not an estimate of 400 simultaneous active users.

| Stored content | Approximate decimal GB |
| --- | ---: |
| 400 portfolios' original media | 41.94 |
| Originals plus one full published copy each | 83.89 |
| Originals plus two full published copies each | 125.83 |
| Originals plus three full published copies each | 167.77 |
| Originals plus five full published copies each | 251.66 |

Published releases copy referenced media into a new release directory. The table assumes every original file is referenced in every release; actual copies may be smaller. Fonts, HTML, database rows/revisions, indexes, logs, container images, build cache and operating-system space are additional. Old published releases currently have no automatic retention cleanup; repeated publishing can exceed any fixed disk allocation. Portfolio deletion cleanup does not implement release retention.

Planning recommendations:

- Small CEO test: KVM 2, 2 vCPU / 8 GB RAM / 100 GB disk, if a suitable existing plan cannot be reused. This is an engineering starting point, not a measured capacity guarantee.
- 400-user production with files in separate object storage: KVM 4, 4 vCPU / 16 GB RAM / 200 GB disk, plus approximately 200 GB initial object-storage budget for originals and up to three full release copies with some headroom. Measure growth and implement retention before launch. Object storage is separately billed; it does not consume VPS disk.
- All files on the VPS: prefer KVM 8 with 400 GB disk. This requires a supported persistent local production-storage configuration that the current production mode does not yet provide. Keep backups off-server. Even 400 GB needs retention and storage alerts.
- A 200 GB all-local setup could fit originals plus two full releases, roughly 30 GB infrastructure overhead and about 44 GB free space. Treat this as a constrained option only after implementing and testing retention; it is not the current out-of-box behavior.

For an initial full backup of an approximately 170–200 GB dataset, budget at least that much separate backup capacity; multiple full backups multiply that amount. Incremental/versioned backup growth depends on change rate. Verify restoration rather than relying solely on server snapshots. Alert at 70% and 85% disk utilization and enforce bounded log/build-cache growth.

Visitor traffic, simultaneous edits, publication jobs and PDF downloads determine compute and bandwidth needs. Load-test representative use before making a performance or uptime commitment. Domain registrations, AI usage, email and backups are separate expenses.

## Published VPS prices

The public USD page displayed these prices when checked; confirm the account's region, term, taxes, total upfront payment and renewal amount at checkout. These are advertised monthly equivalents, not a promise of month-to-month billing.

| Plan | Disk | Advertised monthly equivalent | Displayed renewal monthly equivalent |
| --- | --- | --- | --- |
| KVM 2 | 100 GB | $8.99 | $14.99 |
| KVM 4 | 200 GB | $12.99 | $28.99 |
| KVM 8 | 400 GB | $25.99 | $49.99 |

Source: [Hostinger VPS plans](https://www.hostinger.com/vps-hosting). The page states upfront payment and displays renewal for two years. Regional checkout can differ.

## Step-by-step preparation

1. Sign in to [hPanel](https://hpanel.hostinger.com/). Inspect Websites and VPS. Record the exact purchased plan, remaining storage and whether there is an existing VPS. Do not replace the agency website or reinstall an occupied server.
2. Confirm a test hostname, for example `demo.brilliancyresearch.net`, and identify who manages DNS. This hostname is a proposal, not an already-configured address. Preserve the existing apex, www and email records.
3. If a VPS already exists, inspect its OS, resources and running services before installing anything. Otherwise obtain purchase approval for the selected VPS. Select a nearby data center and a Docker-ready Linux template on a new empty server.
4. Provide developer access using SSH keys or delegated account access. Keep credentials outside Git and Docker build contexts. Restrict SSH/management access; publish only the required HTTP/HTTPS ports. PostgreSQL stays on a private container network.
5. Connect only the private `taharukaiya/Resume-Maker` repository through a read-only deployment credential. Build from a reviewed commit. Deploy PostgreSQL with a persistent volume and the web container behind HTTPS. Run database migrations before accepting traffic.
6. For the small sample-data demo, use `DEPLOYMENT_MODE=demo`, `NODE_ENV=production`, the actual HTTPS `APP_URL`, a private `DATABASE_URL`, separately generated `SESSION_SECRET` and `SETUP_TOKEN`, `AI_PROVIDER=huggingface-browser`, and `RUN_WORKER=true`. Store secrets in the deployment environment. The current Docker image starts the web server but does not run migrations automatically; run `node_modules/.bin/tsx scripts/migrate.ts` in a one-off container with the same environment/network first. Do not run an additional worker alongside the embedded demo worker.
7. Point only the chosen test subdomain to the VPS and issue its HTTPS certificate. Verify `/api/status`. Bootstrap via `/setup?token=` with the private setup token, create the admin, enroll MFA and then remove the setup token. See [FREE_DEMO.md](FREE_DEMO.md) for the same application's bootstrap flow and evaluation checks; its Render provisioning instructions do not apply to Hostinger.
8. Test create/edit/save, image and PDF uploads, CV extraction, article summaries, publishing, separate public pages, mobile navigation, client permissions, inquiries and persistence after container restart. Browser AI still needs a supported admin device and successful external model downloads; changing hosting does not fix that dependency.
9. Back up PostgreSQL, restore it to an isolated test database, and verify sample uploads and published pages. Record the live URL and tested commit only after the actual deployment passes.

## Required work before 400 real users

The current demo is deliberately limited to 200 MiB total file objects, including published copies, and 5 MiB per upload. It stores binary files in PostgreSQL, disables production indexing, and does not provide the production antivirus/email/domain infrastructure. More purchased disk does not remove these application limits.

The current non-demo configuration expects AWS S3/public assets, antivirus and email settings; custom-domain provisioning uses AWS ACM/CloudFront. Hostinger can host the application compute while retaining these services. A wholly Hostinger-based production deployment requires explicit storage/domain/email configuration changes and validation, not merely changing `DEPLOYMENT_MODE` or raising the demo quota.

Before production: choose the storage architecture; implement safe release retention preserving the active release and approved rollback history; configure a separate worker, malware scanning, email and verified custom-domain delivery; migrate demo files deliberately; test backups, permissions, load and recovery; and configure monitoring. This guide does not claim those services have been provisioned.
