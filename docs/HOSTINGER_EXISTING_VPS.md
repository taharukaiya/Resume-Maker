# Deploy alongside existing Hostinger portfolios

**Server inspection is complete: this agency uses EasyPanel with an attachable Docker overlay. Follow [the EasyPanel-specific walkthrough](HOSTINGER_EASYPANEL.md).** The host-proxy instructions below remain for other server types; do not use their loopback destination for EasyPanel's containerized Traefik.

**Start here for the agency's existing VPS.** Do not follow the empty-server instructions to replace its web server. The current sites, including `researchbytresna.com`, must stay on their current application until a planned migration.

## What has been prepared

- An existing-server Compose mode publishes only **127.0.0.1:8088**. It does not claim public ports 80/443. The current server or panel continues handling public HTTPS.
- PostgreSQL, private uploads, a worker and ClamAV stay inside the new application's containers/volumes. No cPanel licence is needed.
- Once a researcher domain is verified, activated and connected to this application, `/` serves that portfolio and `/login` redirects to the central studio login. Administrators manage all portfolios; client access remains limited by their account permissions. A domain name never grants admin rights.
- Free email and AI setup is described in [Free services setup](FREE_SERVICES_SETUP.md). Hosting, domains and backup storage retain their existing costs.

No VPS changes, email-provider setup, DNS updates or migration have been performed from this project. Docker is unavailable on the local development computer; require successful GitHub Actions container checks before installing. The final front-proxy configuration depends on the actual server inventory.

## Phase 1 — when your boss is available (read-only)

1. Sign in at [Hostinger hPanel](https://hpanel.hostinger.com/). Have your boss enter the email verification code directly. Do not put it in this chat or project files.
2. Open **VPS → select the current VPS → Manage / Overview**. Record the plan, RAM, total/used disk, OS, and any installed panel. Take a screenshot without credentials. See [Hostinger's dashboard guide](https://www.hostinger.com/support/5726606-how-to-use-the-vps-dashboard-in-hostinger/).
3. Identify who maintains the existing sites. Ask for a current backup of their files, databases, certificates and web-server configuration, stored off the VPS. A fresh backup must precede any upgrade or deployment. Do not reinstall the OS, reset the server, delete old sites or remove a panel.
4. Open Hostinger's browser terminal if available, or use Windows PowerShell: `ssh YOUR_SSH_USER@YOUR_VPS_IP`. Replace those two values with the ones provided by the server administrator. Do not confuse the Hostinger account password with an SSH login.
5. Run these **read-only** commands in the VPS terminal:

```bash
cat /etc/os-release
df -hT
free -h
sudo ss -ltnp
systemctl is-active nginx apache2 httpd caddy lsws docker
docker --version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

An inactive service or `command not found` is useful information, not a reason to install/restart anything. Share the output after reviewing hostnames/IPs. Do not share `.env`, passwords, API keys, full configuration dumps or login codes. If the repository is already cloned, `bash deploy/vps/inspect-server.sh` gathers equivalent information plus read-only Docker disk usage.

**Pause here and provide the inventory.** This is necessary because the existing proxy may be Nginx, Apache, LiteSpeed, a panel-managed proxy, or another Docker container. Their connection and certificate steps differ. Do not run a generic web-server installer on the live VPS.

## Phase 2 — confirm capacity and a test address

Complete this after reviewing Phase 1 with the server administrator:

1. Determine whether the planned 400 portfolios include the current sites or are additional. At 100 MiB of media each, 400 portfolios plus three full published copies need about **168 GB before database, OS and spare capacity**. A **400 GB** disk is the planning recommendation for that new workload; add retained existing-site usage where appropriate. It is not a promise that every current server will fit.
2. Budget memory for existing sites plus this application's containers. Their configured ceilings total roughly 10 GB for web, worker, database and scanner, before the OS/proxy and build process. Measure current usage and leave headroom. Disk shortage must be resolved before building; never run Docker prune or delete backups blindly.
3. If a Hostinger upgrade is needed, verify its available capacity, downtime and rollback options with Hostinger and schedule it with your boss. Storage upgrades cost money; do not buy cPanel. Confirm filesystem capacity again with `df -hT` after the upgrade.
4. Approve two **unused** subdomains, such as `studio.brilliancyresearch.net` and `media.brilliancyresearch.net`. Confirm the names are free before changing DNS. Point only these new hostnames to the existing VPS. Keep the agency root domain, existing researcher hosts and mail DNS untouched.
5. Confirm port 8088 is unused, and no containers/volumes already belong to Compose project `brilliancy`. Check `docker ps -a --filter label=com.docker.compose.project=brilliancy` and `docker volume ls --filter label=com.docker.compose.project=brilliancy`. If anything exists, establish whether it is this application before proceeding.
6. Use the existing supported Docker installation. This mode requires Compose **2.24.4 or newer** for replacing port mappings. If Docker is absent or needs upgrading, have the existing server operator plan that change first; Docker installation can change firewall behavior. If the host proxy is containerized, its network needs a specific plan—do not expose 8088 publicly as a workaround.

## Phase 3 — put the application on the server

These steps prepare a new installation after capacity and compatibility are confirmed. If `/opt/brilliancy` already contains an installation, back it up and update it instead; do not clone over it or regenerate its secrets.

1. Create a dedicated GitHub read-only deploy key on the VPS:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/brilliancy_deploy -C brilliancy-vps-readonly
cat ~/.ssh/brilliancy_deploy.pub
```

Do not overwrite an existing key if prompted. Copy **only the `.pub` output** into **GitHub → taharukaiya/Resume-Maker → Settings → Deploy keys → Add deploy key**. Leave write access unchecked. Keep the private key on the server. Verify GitHub's SSH host fingerprint using [GitHub's documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints) before accepting its host-key prompt.

2. Clone into a new directory using that key:

```bash
sudo install -d -m 0750 /opt/brilliancy
sudo chown "$(id -u):$(id -g)" /opt/brilliancy
GIT_SSH_COMMAND='ssh -i ~/.ssh/brilliancy_deploy -o IdentitiesOnly=yes' git clone git@github.com:taharukaiya/Resume-Maker.git /opt/brilliancy
cd /opt/brilliancy
git config core.sshCommand 'ssh -i ~/.ssh/brilliancy_deploy -o IdentitiesOnly=yes'
git log -1 --oneline
```

3. Open [GitHub Actions](https://github.com/taharukaiya/Resume-Maker/actions) and confirm that exact commit passed, including **vps-image**. Do not deploy a failed or still-running build.
4. Generate configuration:

```bash
bash deploy/vps/configure.sh
```

Select **existing** at the first prompt. Enter the approved studio/media names and agency email addresses. This generates unique secrets, refuses to overwrite an existing `.env`, and writes:

```dotenv
COMPOSE_FILE=compose.yaml:compose.existing.yaml
EMAIL_PROVIDER=resend
AI_PROVIDER=huggingface-browser
```

5. Follow [free email setup](FREE_SERVICES_SETUP.md) to verify a sender domain and add `RESEND_API_KEY` and `EMAIL_FROM` using `nano deploy/vps/.env`. Keep the Resend Free plan. Do not share the file. Keep `DEPLOYMENT_MODE=vps` as supplied by Compose and retain the generated session/database secrets.
6. Start the isolated application from **this directory**, so Compose reads its `.env`:

```bash
cd /opt/brilliancy/deploy/vps
docker compose config --quiet
docker compose build web
docker compose up -d db scanner
docker compose run --rm migrate
docker compose up -d web worker caddy
docker compose ps
```

Use plain `docker compose` from this directory. Do not add `-f compose.yaml` alone: that overrides `COMPOSE_FILE` and selects the empty-server public-port configuration. The only published address in `docker compose ps` should be **127.0.0.1:8088**, not `0.0.0.0:80/443` or a public 8088. Do not run these commands from the root of a different application. No database, scanner or application port needs a firewall opening.

## Phase 4 — connect the NEW studio/media hosts

**The exact commands for this phase will be supplied after Phase 1.** An existing panel may overwrite hand-edited configurations. Do not replace a default Nginx/Apache/Caddy configuration or disable the current web server.

The existing host proxy needs two new HTTPS sites with valid certificates, forwarding requests to `http://127.0.0.1:8088` while preserving the original hostname. Its HTTP sites should redirect to HTTPS. It must overwrite `X-Brilliancy-IP` with the trusted client IP, permit 22 MB request bodies, avoid caching studio/API traffic, and avoid logging setup/reset query tokens. The repository contains `deploy/vps/nginx-location.conf` as a reviewed **location fragment**, not a complete server configuration. It applies only to host-installed Nginx without another unconfigured proxy/CDN in front. Apache/LiteSpeed/containerized proxies require their corresponding configuration. Keep certificate renewal under the existing server's manager; internal Caddy does not issue certificates in this mode.

After configuration validation, reload only through the existing manager's supported method. Check both old websites and new hosts immediately. Keep the old configuration so it can be restored if a new route fails.

Verify with the actual approved hostname (substitute it below if different):

```bash
curl --fail -H 'Host: studio.brilliancyresearch.net' http://127.0.0.1:8088/api/status
curl --fail https://studio.brilliancyresearch.net/api/status
curl -I https://studio.brilliancyresearch.net/login
curl -I https://media.brilliancyresearch.net/private/test.pdf
```

The status endpoint should respond; the private-media request must return 404. Verify that 8088 is unreachable externally. Keep new hosts DNS-only initially; a CDN requires correctly configured trusted-client-IP handling. Open the studio in a browser and check HTTPS before signing in.

## Phase 5 — create the administrator and test

1. Privately read `SETUP_TOKEN` in the server `.env` and open `https://YOUR_STUDIO_HOST/setup?token=YOUR_SETUP_TOKEN`. Create your real admin account, log in and enable authenticator-based two-factor authentication.
2. Clear only `SETUP_TOKEN` in `.env` after setup; keep the session/database secrets. Run `docker compose up -d web worker` from `deploy/vps`.
3. Create a disposable test portfolio and a client test account. Test email invitation/recovery, permitted client edits, image/CV/article uploads, malware scanning, AI on the chosen computer, saving, publishing, mobile navigation, favicon and contact messages. The new database does not import old websites or accounts automatically.
4. Confirm every existing portfolio still works. Complete a backup and restore drill for the new application using the launch guide. `sudo bash backup.sh` pauses **only this Compose application**, and does not back up unrelated existing sites or the external proxy/TLS configuration. Back up those separately using the current system's tools.

## Phase 6 — migrate ONE researcher domain after approval

Do not point all current sites at the new application at once. Changing a domain's routing replaces what visitors and `/login` users see. Old application accounts and sessions do not transfer automatically.

1. Back up the old website and database. Recreate/import its approved content and media into a portfolio here, assign its client account, publish at the shared studio address, and compare the content/routes. There is no universal automatic migration from the existing application.
2. In Review & publish, add its domain and verify the displayed TXT record. This proves ownership without moving traffic.
3. On the VPS, set `DOMAIN` to that verified hostname and generate an internal route. Do not overwrite an existing generated route without reviewing it:

```bash
cd /opt/brilliancy/deploy/vps
DOMAIN=researchbyname.com
docker compose run --rm --no-deps -T web node node_modules/tsx/dist/cli.mjs scripts/vps-domain.ts config "$DOMAIN" > "domains/$DOMAIN.caddy.pending"
```

Inspect the file; its first line must use `http://YOUR_DOMAIN:8080`. It must not claim public TLS ports. During the agreed change window:

```bash
mv "domains/$DOMAIN.caddy.pending" "domains/$DOMAIN.caddy"
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose run --rm --no-deps web node node_modules/tsx/dist/cli.mjs scripts/vps-domain.ts activate "$DOMAIN"
```

4. Republish in the admin panel. On the VPS, test before moving external traffic:

```bash
curl --fail -H "Host: $DOMAIN" http://127.0.0.1:8088/
curl -I -H "Host: $DOMAIN" http://127.0.0.1:8088/login
```

`/login` should return 302 to the central studio's `/login`. It does not automatically sign anyone in, and drops query parameters from the researcher URL.

5. Have the existing proxy route **only this domain** to port 8088. If its DNS already points to this VPS, DNS may not need changing; the virtual-host route is what changes. Preserve valid TLS and mail records. Add a `www` redirect separately if required and preserve/redirect old public page paths.
6. Test its public homepage, all pages, assets, contact form and `/login`, then sign in as the assigned client and verify permissions. Check the other old sites again. If anything fails, restore this domain's previous proxy route and leave the old app running; restore DNS only if it was changed. Keep both data stores until the migration is approved.

Your first action is **Phase 1**, once your boss can complete Hostinger sign-in. The files are prepared; installing into an unidentified, capacity-constrained live server would not be a safe deployment.

Technical references: [Compose environment selection](https://docs.docker.com/compose/how-tos/environment-variables/envvars/), [Compose port replacement](https://docs.docker.com/reference/compose-file/merge/), [Nginx upstream headers](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header).
