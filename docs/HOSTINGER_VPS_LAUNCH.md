# Hostinger VPS launch — no cPanel

**The agency has confirmed this VPS already hosts portfolios. Follow [Existing VPS deployment](HOSTINGER_EXISTING_VPS.md) instead.** This document applies only to a separate empty server.

Use this guide for a **new VPS or a confirmed empty server**. Do not reinstall an existing server, replace an existing web-server configuration, or change the DNS of a live researcher website while following the initial setup. The agency’s existing sites remain on their current hosting until a separately approved cutover.

The account credentials in `hostinger.txt` are not server connection details. Keep that file private. They do not establish which plan is purchased, the VPS IP, operating system, or permission to interrupt an existing website.

## 1. Ask the agency for these details

Send this message:

> Please confirm the Hostinger VPS plan, available disk/RAM, server IP, operating system, and whether anything already runs on it. Please give me delegated Hostinger access and an SSH public-key login, not passwords in chat. Which domains are already live, who controls their DNS, and what exactly is the restriction involving the 11 October deployment? Please approve two NEW subdomains for the studio and media server. I also need an agency-owned verified email sender, an AI billing decision, an off-server backup destination, and approval of a test and rollback window before any existing researcher domain changes.

In Hostinger hPanel, open **VPS → Manage / Overview**. Website/shared hosting alone is not the Docker VPS setup below. hPanel is Hostinger’s account dashboard; purchasing cPanel is unnecessary. The application has its own admin interface.

## 2. Capacity and purchase recommendation

The application allows **100 MiB of original media per portfolio**. This is not a cap on the total space used by its published releases, database, backups, or operating system.

| Planning item for 400 portfolios                                             |                   Estimated disk |
| ---------------------------------------------------------------------------- | -------------------------------: |
| Original media: 400 × 100 MiB                                                |               39.1 GiB / 41.9 GB |
| Three retained full published copies, conservative upper estimate            |             117.2 GiB / 125.8 GB |
| OS, Docker images, fonts/HTML, database, scanner signatures and bounded logs | Allow another 20–35 GB initially |
| Expected full-capacity budget before spare space                             |         Approximately 188–203 GB |
| Recommended local disk                                                       |                  **400 GB NVMe** |

This is a capacity model, not a load-test result. Releases copy only referenced media, so actual use may be lower. Failed publication artifacts, draft history, inquiries, builds and backups can add space. Alert at 70% used and act before 80%. Three releases are retained after each successful publication when `RELEASE_RETENTION=3`; older releases and their files are removed by the worker. Editing revisions remain. A portfolio published repeatedly without this setting has unbounded release storage.

**For 400 portfolios stored on the VPS, choose KVM 8 (400 GB, 32 GB RAM, 8 vCPU).** Its extra RAM/CPU is a consequence of the storage tier, not evidence that low-traffic portfolios need that much CPU. KVM 4 (200 GB, 16 GB RAM, 4 vCPU) is suitable for an initial smaller rollout but is tight at the stated full-media limit. KVM 2 (100 GB, 8 GB RAM) is a small demonstration option, not a 400-portfolio local-storage plan. Object storage could later separate storage capacity from VPS compute.

Hostinger’s US page checked on 13 October 2026 advertised KVM 4 at **$12.99/month initially**, renewing at **$28.99/month for two years**, and KVM 8 at **$25.99/month initially**, renewing at **$49.99/month for two years**. Plans are prepaid; country, term, tax and promotions change the checkout total. Recheck the [official pricing](https://www.hostinger.com/vps-hosting) before purchasing.

Budget separately for each researcher’s domain renewal, transactional email, AI API usage, and encrypted off-server backups. cPanel, Docker Engine and Caddy add no licence fee in this setup. Allow at least 250–400 GB initially for an off-server backup repository, then size it by retention and change rate. Do not keep daily full backups on the application disk. Hostinger’s included weekly backup is useful but does not replace tested, independent backups. [Hostinger backups](https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps/)

## 3. Prepare a new server and DNS

1. Choose a current supported Ubuntu LTS image, such as Ubuntu 24.04, on the new VPS. Choose a region close to most users. Never use **Reinstall OS** on a server with existing sites.
2. Add your SSH public key through hPanel. On Windows, generate a dedicated key if needed: `ssh-keygen -t ed25519`. Share only the `.pub` file. Keep the private key private.
3. In the Hostinger firewall, permit TCP 22 only from your current trusted IP; permit TCP 80 and TCP/UDP 443 for visitors. Do not open 3000, 5432 or 3310. Keep hPanel’s recovery console available. Docker-published ports can bypass UFW rules; the provider firewall and the Compose file’s limited published ports both matter.
4. Create two new DNS A records, for example `studio.brilliancyresearch.net` and `media.brilliancyresearch.net`, pointing at the new VPS IPv4. These are proposed names, not records this task has created. Confirm they are unused first. Do not replace the agency’s root A record, MX records, or existing researcher DNS.
5. Start with DNS-only records. Add IPv6 AAAA records only if IPv6 routing and firewall rules are working. Incorrect AAAA records can break certificate issuance.
6. Connect from PowerShell with `ssh your-ssh-user@YOUR_VPS_IP` using the username/IP shown in hPanel. All commands below run in the VPS’s Linux terminal, not PowerShell.

Install Docker using its [official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/), including the Compose plugin. If using Hostinger’s Docker OS template, verify the installed tools instead. Verify:

```bash
docker version
docker compose version
sudo apt update
sudo apt install -y git openssl unattended-upgrades
```

Enable security updates and set a maintenance window for reboots. Use a named administrator and SSH keys; verify a second working SSH session before disabling password/root SSH login. Docker-group membership is effectively root access, so restrict it to server operators.

## 4. Clone the private repository

Create a dedicated read-only GitHub deploy key for this server. Add its public key in **Resume-Maker → Settings → Deploy keys** without write access. Do not place an access token in a clone URL or commit credentials.

```bash
sudo install -d -m 0750 /opt/brilliancy
sudo chown "$(id -u):$(id -g)" /opt/brilliancy
git clone git@github.com:taharukaiya/Resume-Maker.git /opt/brilliancy
cd /opt/brilliancy
git log -1 --oneline
bash deploy/vps/configure.sh
```

The configure script prompts for the two hostnames and email addresses and generates fresh passwords, session encryption and setup secrets in `deploy/vps/.env` with private permissions. It refuses to overwrite an existing configuration. Enter real values; never copy development `.env` into production blindly.

For this empty-server guide, select **new** at the initial mode prompt. The default **existing** mode is for a VPS whose current web server must retain ports 80/443.

Edit the server file privately:

```bash
nano deploy/vps/.env
```

Use the free setup in [Free services setup](FREE_SERVICES_SETUP.md):

1. Create a Resend Free account, verify a sending subdomain, and create a sending-only API key.
2. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM` in the server environment. Keep the Free plan and monitor its daily/monthly allowance. AWS credentials are not needed.
3. Keep `AI_PROVIDER=huggingface-browser` for AI without API fees. Use a compatible desktop browser; first-use model downloads and hardware requirements are described in the free setup guide. No paid provider fallback is used.
4. Existing deployments keep their settings until you edit their environment. Do not regenerate passwords or encryption secrets when updating.

Do not delete current email DNS records. Use an unused sending subdomain and copy only the records requested by Resend. Test invitation and password-reset delivery before launch.

CV extraction and automatic summaries are not launch-verified until real documents pass on the chosen computer or provider. Keep `DEPLOYMENT_MODE=vps` as defined by Compose; never use demo mode to bypass scanning or configuration checks. Keep `RELEASE_RETENTION=3` unless you revise the storage budget.

## 5. Build, migrate and start

First confirm GitHub Actions is green for the exact commit. The VPS-image job builds the Linux container and validates Compose/Caddy; browser checks run separately. A successful local build does not prove server readiness.

```bash
cd /opt/brilliancy/deploy/vps
docker compose config --quiet
docker compose build web
docker compose up -d db scanner
docker compose run --rm migrate
docker compose up -d web worker caddy
docker compose ps
docker compose logs --tail=80 web worker caddy scanner
```

Do not run `docker compose config` without `--quiet` when sharing output: expanded configuration contains secrets. The database uses a separate restricted runtime role; only the one-shot migration service receives the database-owner password. Web and worker share a persistent media volume. Caddy serves only the published `releases` subtree on the media host; private originals are not a public file directory. ClamAV’s first signature download may take several minutes; uploads fail closed until it is available.

Only Caddy publishes public ports. Caddy obtains and renews HTTPS certificates. If HTTPS fails, inspect DNS A/AAAA, CAA records and inbound 80/443 access; do not disable TLS checks. Verify Caddy configuration before reloading:

```bash
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Open `https://YOUR_STUDIO_HOST/login`. To bootstrap, privately read `STUDIO_HOST` and `SETUP_TOKEN` from the server’s `.env`, then open `https://YOUR_STUDIO_HOST/setup?token=YOUR_SETUP_TOKEN`. Do not post that link in chat, tickets or screenshots. Create the real administrator, sign in, and enable two-factor authentication under Settings & security. Production administrator actions require MFA.

After setup, remove the `SETUP_TOKEN` value from the server file, then:

```bash
docker compose up -d web worker
```

This is a fresh database. Local portfolios and files do not appear automatically. If you need to transfer existing local or old-server content, preserve a full backup of its database, storage and encryption key and arrange an explicit migration before switching domains. A portfolio JSON export alone is not a full backup and does not include file bytes. Never overwrite the existing production database with test data.

## 6. Test before connecting existing domains

Use a clearly marked test portfolio and test accounts on the new studio address. Check:

- HTTPS is valid; `/api/status` returns initialized true. No CEO/demo banner appears.
- Login, logout, mandatory admin MFA, invitation and password-reset delivery all work. Test using a real recipient you control, including junk folders.
- A client can edit only its assigned fields, cannot open another portfolio’s files, and cannot publish/delete or manage accounts.
- JPEG/PNG portrait, transparent portrait, PDF CV, and article upload work through the malware scanner. Confirm the scanner rejects the standard EICAR test file in an isolated test; never upload real malware.
- CV extraction and article summarization finish using the selected provider. Review factual accuracy, dates and links. Test a scanned PDF if clients use scans.
- All six designs, long names, long publication titles, small screens, hamburger navigation, keyboard focus, reduced-motion preference, contact forms, photo favicon and tab titles work.
- Save, publish, edit without publishing, restore an available release, unpublish, and delete a disposable portfolio. Confirm older editing drafts are not exposed.
- Contact messages arrive in the application inbox; this workflow does not automatically email the researcher.
- Inspect source/canonical URL, page title, descriptions, robots and `/sitemap.xml`. Set a test portfolio’s Search & sharing option to noindex. Switch indexing on only for approved live portfolios.
- Back up, restore into a separate disposable server, and confirm an uploaded PDF/photo, login and published page survive the restore.

Keep existing live domains on their current service until these pass and the agency approves the change window. Low traffic is not proof of resilience; monitor RAM, disk, database connections and HTTP errors during representative uploads/publishing and a controlled load test.

## 7. Connect an individual researcher domain

Each `researchbyNAME.com` is its own registered domain, not an automatically free subdomain. Confirm ownership and existing DNS before buying/changing anything. For an already-live site, record its old IP, DNS settings, routes, content and backup. Keep its old hosting paid and available during the rollback window.

1. In **Review & publish → Website address**, add the exact hostname and create the displayed `_brilliancy` TXT record. Verify it in the editor. TXT verification does not redirect live visitors.
2. In the VPS terminal below, replace `researchbyname.com` with the actual verified hostname. Generating a Caddy configuration does not itself change DNS:

```bash
cd /opt/brilliancy/deploy/vps
DOMAIN=researchbyname.com
docker compose run --rm --no-deps -T web node node_modules/tsx/dist/cli.mjs scripts/vps-domain.ts config "$DOMAIN" > "domains/$DOMAIN.caddy.pending"
```

3. Inspect the generated file. During the **approved cutover window**, rename it and validate the whole proxy before reload:

```bash
mv "domains/$DOMAIN.caddy.pending" "domains/$DOMAIN.caddy"
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose run --rm --no-deps web node node_modules/tsx/dist/cli.mjs scripts/vps-domain.ts activate "$DOMAIN"
```

4. Change **only this domain’s** intended A/AAAA records to the new server. Leave MX/SPF/DKIM and unrelated hostnames untouched. Caddy must obtain a certificate; this DNS-based process can involve a short transition, so do not promise zero downtime. A zero-downtime migration needs a separate pre-issued-certificate/DNS-challenge plan.
5. Republish the portfolio so canonical URLs, navigation, favicon, fonts and the sitemap use the personal domain. Test HTTPS, `/`, every navigation page, assets and the contact form. This host serves only portfolio content, never the admin panel.
6. If `www` is needed, add an explicit Caddy redirect with valid TLS after proving control of that hostname too. Preserve or redirect old page paths if they differ from the new website.

If verification fails, return the DNS to its recorded old target. To deactivate the new mapping, run `scripts/vps-domain.ts deactivate "$DOMAIN"` through the same container command and republish the shared address. Changing DNS back is not instantaneous; leave the old service running until propagation settles.

## 8. Backups, restoration and updates

From the VPS, run:

```bash
cd /opt/brilliancy/deploy/vps
sudo bash backup.sh
```

This pauses web/worker/proxy briefly for a consistent database-plus-files snapshot, writes a timestamped backup under `/var/backups/brilliancy`, includes private configuration, and restarts services. Allow enough temporary disk space. Store backups encrypted off the VPS immediately, restrict access, verify checksums and test restoration. Automate only after a manual backup and restore succeed. Monitor backup failures. The script intentionally does not silently delete your older backups; apply a documented retention policy after off-server verification.

For a restoration drill, use a **new disposable VPS and empty volumes**. Copy the backup securely. Restore configuration privately, change test hostnames to avoid the live domains, and build the same app commit. Start only `db`, then restore:

```bash
# Run from deploy/vps on the disposable server. Supply the actual backup paths.
docker compose up -d db
docker compose exec -T db pg_restore -U postgres -d brilliancy --no-owner --no-privileges < /secure-backup/database.dump
docker compose run --rm --no-deps -T --entrypoint tar web -xz -C /data --no-same-owner < /secure-backup/files.tar.gz
docker compose run --rm --no-deps -T --entrypoint tar caddy -xz -C /data < /secure-backup/certificates.tar.gz
docker compose run --rm migrate
docker compose up -d scanner web worker caddy
```

Do not run these restore commands against populated production data. Preserve the original `SESSION_SECRET`, which protects MFA secrets. Test backups privately; test copies must not send real client email or become indexed. Republish a test portfolio for the test origin rather than following old public URLs.

For updates, record the current commit and make a verified backup first. Pull with `git pull --ff-only`, validate Compose, rebuild, run migrations, and recreate web/worker. Keep the previous image identified by a commit tag. Database changes may require restoring the matching database/files backup; checking out old code alone is not always a safe rollback. Never use `docker compose down -v` on production: it deletes persistent volumes.

## 9. Continuing security and operations

- Use agency-owned accounts, MFA, scoped credentials and prompt access removal. Rotate credentials if exposed. `hostinger.txt`, real `.env` files and backups remain outside Git and Docker build context.
- Monitor `/api/status`, a real published page, disk usage, worker errors, scanner updates, backup age and certificate renewal. Health checks do not automatically repair failed application containers; set external alerts and a recovery procedure.
- Keep Docker/base images, OS packages and application dependencies updated, testing each update. Run `npm audit` and the CI gates for each release.
- Consider an edge CDN/WAF for volumetric DDoS and bot protection after configuring trusted client-IP handling. Never cache authenticated/API traffic. The initial Caddy setup overwrites `X-Brilliancy-IP` with the connecting address; adding a CDN requires revisiting this so rate limits do not group all visitors behind the CDN.
- Review retention, client consent for AI document processing, privacy notices and inquiry handling with the agency. Avoid sensitive client documents in free AI demos.

A single VPS is a single point of failure. This setup reduces common risks; it cannot guarantee immunity to all attacks or uninterrupted availability. Higher availability requires off-server backups, tested recovery, monitoring and eventually redundant infrastructure.

Sources: [Hostinger VPS dashboard](https://www.hostinger.com/support/5726606-how-to-use-the-vps-dashboard-in-hostinger/), [Docker Ubuntu setup](https://docs.docker.com/engine/install/ubuntu/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [ClamAV Docker guidance](https://docs.clamav.net/manual/Installing/Docker.html).
