# The agency's EasyPanel VPS: deployment walkthrough

This is the guide for the server inspected on 13 October 2026: Ubuntu 24.04, EasyPanel 2.32.1, Docker 29.6.1, Compose 5.3.0, 2 cores, about 7.8 GiB RAM and 85 GB disk available. Existing sites run in Docker Swarm. The `easypanel` overlay is attachable and already contains `easypanel-traefik`.

Use **easypanel** mode below. The earlier **existing** mode is for a host-installed proxy and is not the correct configuration for this server.

## How it will connect

EasyPanel will retain public HTTP/HTTPS and certificates. Two new domain entries will send traffic to `http://brilliancy-portfolio-gateway:8080/` on its existing overlay. Only our gateway joins that network; our PostgreSQL, scanner, worker and web application stay on their own Compose network. No additional host ports are published. There is no need to edit the running Traefik service or buy an EasyPanel licence for this terminal-managed installation. It is managed with Docker Compose in the terminal, not as a native EasyPanel project card.

The pilot caps total steady-state container memory at 4.5 GiB: web 640 MiB, worker 512 MiB, database 256 MiB, scanner 3 GiB, gateway 128 MiB. The migration container runs separately before web/worker. Limits are ceilings, not reserved/guaranteed available RAM. This is a constrained test deployment, not validated capacity for 400 portfolios. ClamAV's documented minimum is 3 GiB and preferred allocation is 4 GiB. Keep scanning enabled; if signatures, scans or large uploads fail within the budget, stop the pilot and reassess capacity rather than removing security checks. [ClamAV memory guidance](https://docs.clamav.net/manual/Installing/Docker.html)

## 1. Prepare accounts and backups

- Confirm an off-server backup of the existing websites, databases and EasyPanel configuration is available before installation. A displayed weekly schedule alone does not establish that restoration works.
- Approve two unused subdomains, for example `studio.brilliancyresearch.net` and `media.brilliancyresearch.net`. These are proposed names, not automatically created DNS records.
- Follow [Free services setup](FREE_SERVICES_SETUP.md) to create a Resend Free sending key and verify an unused sending subdomain. Keep the Free plan. Browser AI needs no API key; its hardware/download requirements remain.
- Leave the existing researcher domain entries, applications and pending OS upgrade/reboot unchanged during this test.

## 2. Allow this VPS to read the private GitHub repository

Run these in the Hostinger Web console, which is currently logged in as root:

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
if [ ! -e /root/.ssh/brilliancy_deploy ]; then
  ssh-keygen -t ed25519 -f /root/.ssh/brilliancy_deploy -C brilliancy-vps-readonly -N ''
fi
cat /root/.ssh/brilliancy_deploy.pub
```

Copy the single `ssh-ed25519 ...` public-key line. Open [the repository deploy-key settings](https://github.com/taharukaiya/Resume-Maker/settings/keys), click **Add deploy key**, name it `Hostinger Brilliancy read-only`, paste the public key and leave **Allow write access unchecked**. Save. Never copy the file without `.pub`; that is the private key. If the command says the public key is missing, stop and inspect the existing key rather than overwriting it.

Check that the destination does not already exist:

```bash
ls -ld /opt/brilliancy
```

`No such file or directory` is expected for a first installation. If it exists, inspect it before any clone/update. For a new directory:

```bash
GIT_SSH_COMMAND='ssh -i /root/.ssh/brilliancy_deploy -o IdentitiesOnly=yes' git clone git@github.com:taharukaiya/Resume-Maker.git /opt/brilliancy
cd /opt/brilliancy
git config core.sshCommand 'ssh -i /root/.ssh/brilliancy_deploy -o IdentitiesOnly=yes'
git log -1 --oneline
```

When SSH first asks to trust GitHub, verify the fingerprint against [GitHub's official fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints). Do not disable host-key verification. If Git is missing, report the error instead of running an unrelated OS upgrade.

## 3. Configure the application

First verify there is no unrelated application already using our Compose name:

```bash
docker ps -a --filter label=com.docker.compose.project=brilliancy
docker volume ls --filter label=com.docker.compose.project=brilliancy
```

If either lists existing resources, determine who owns them before proceeding. Do not delete or reuse an unknown volume.

From `/opt/brilliancy`:

```bash
bash deploy/vps/configure.sh
```

At the mode prompt, type **easypanel**. Supply the approved studio/media hostnames and email addresses. The script checks the attachable overlay, reads its subnet for trusted-proxy handling, generates fresh secrets and refuses to overwrite an existing `.env`. It does not modify Docker networks or domains.

Privately edit the generated configuration:

```bash
nano deploy/vps/.env
```

Ensure these settings are present; the script sets all except your private Resend key:

```dotenv
COMPOSE_FILE=compose.yaml:compose.easypanel.yaml
EMAIL_PROVIDER=resend
AI_PROVIDER=huggingface-browser
```

Add `RESEND_API_KEY` and confirm `EMAIL_FROM` belongs to your verified sending domain. Keep the generated `EASYPANEL_PROXY_CIDRS`, database passwords and session secret. Save in nano with **Ctrl+O**, Enter, then **Ctrl+X**. Do not paste the file into chat or run unredacted `docker compose config`.

## 4. Build with bounded resources

Confirm [GitHub Actions](https://github.com/taharukaiya/Resume-Maker/actions) is green for the exact checked-out commit, including **vps-image**. Its checks include merged Compose configuration, Caddy validation and an isolated attachable Swarm network startup. Local TypeScript/build checks do not establish that these Linux checks passed.

Then, from `/opt/brilliancy`:

```bash
bash deploy/vps/build-limited.sh
```

This requires at least 4 GiB currently available RAM and 15 GiB disk at the checkout, and refuses to build while this Compose project is running. It creates a temporary BuildKit builder capped at 3 GiB and one CPU, builds with one Next.js page worker, loads `brilliancy:local` plus a commit tag, and removes only its own builder. It does not restart existing services. Docker image storage can be on a different filesystem; verify its capacity too if the server uses a custom Docker data directory.

Do not use the unbounded `docker compose build` path on this shared VPS. If the bounded build fails, share the final error with secrets removed; do not bypass the resource limits. For later updates, build elsewhere or schedule a backup and stop only this new application's containers before rebuilding. Leave the old projects running.

## 5. Start privately, then check resource use

Run from the exact deployment directory so Compose reads the correct `.env`:

```bash
cd /opt/brilliancy/deploy/vps
docker compose config --quiet
docker compose up -d --no-build db
docker compose run --rm migrate
docker compose up -d --no-build scanner web worker caddy
docker compose ps
docker stats --no-stream
free -h
```

The migration waits for the database health check. ClamAV initially downloads its signatures; uploads fail closed until it is ready. Review `docker compose logs --tail=60 scanner web worker caddy` privately if a container is restarting. A low memory ceiling can terminate a container; do not assume a running page proves upload/scanner reliability.

Only these new containers should appear under the `brilliancy` Compose name, with **no published host ports**. Existing services must remain healthy. If existing websites slow down or resources become scarce, stop just the new stack with `docker compose stop` from this directory and reassess. Do not run global Docker prune, stop EasyPanel, or run `docker compose down -v`.

## 6. Add the two NEW HTTPS addresses

Add DNS A records for the approved unused studio/media subdomains pointing to this VPS. Keep DNS-only routing initially; do not change existing researcher A records or the agency root/MX records.

In **EasyPanel → Domains → Add Domain**, add each approved hostname with:

| Setting                     | Value                                                      |
| --------------------------- | ---------------------------------------------------------- |
| Public host                 | The exact studio or media hostname entered in `.env`       |
| Public path                 | `/`                                                        |
| HTTPS                       | Enabled, using the existing automatic certificate resolver |
| Destination/custom upstream | `http://brilliancy-portfolio-gateway:8080/`                |
| Preserve original Host      | Enabled/default; do not replace it with the upstream name  |

Both public names use the same destination. The gateway distinguishes studio from media by hostname. EasyPanel's form labels vary by version; if it does not offer a custom destination, send that form's screenshot before saving. Do not select `education_web-master` as the target. Do not enable caching on the studio/API route. Keep request body limits at least 22 MB and upstream timeouts at least 120 seconds if overriding them. Existing Traefik must sanitize incoming forwarded headers; do not enable `forwardedHeaders.insecure`. The gateway uses right-to-left forwarded-IP parsing and trusts only the configured overlay CIDR, overwriting user-supplied `X-Brilliancy-IP`.

Check in the browser:

- `https://YOUR_STUDIO_HOST/login` loads with a valid certificate.
- `https://YOUR_STUDIO_HOST/api/status` responds.
- `https://YOUR_MEDIA_HOST/private/test.pdf` returns 404.
- All old researcher websites still load.

Do not expose the gateway on the server's public port 8080/8088 if routing fails. Confirm the domain spelling, overlay membership and destination using logs instead. Adding the new route does not require replacing the current Traefik service or proxy configuration.

## 7. Bootstrap and test

Privately read `SETUP_TOKEN` from the server `.env`, open the studio `/setup?token=...` URL, create the administrator and enable authenticator MFA. Clear the setup token afterward and run `docker compose up -d --no-build web worker`.

Create a disposable test portfolio and a test client. Test login/MFA, email invitation and recovery, field permissions, image/CV/article uploads, actual malware scanning, browser AI, publishing, mobile layouts and inquiry delivery to the inbox. Review extracted facts. Confirm an uploaded file and login survive a container restart. Complete an off-server backup/restore test before client use; `backup.sh` covers only this application, not existing Swarm services or EasyPanel's proxy/TLS configuration.

Do not migrate `researchbytresna.com` or any current client yet. A fresh database has none of their existing content or accounts. When an individual portfolio is approved for migration, follow Phase 6 in [Existing VPS guide](HOSTINGER_EXISTING_VPS.md), but connect its EasyPanel domain to **`http://brilliancy-portfolio-gateway:8080/`**, not host port 8088. Generate its internal domain route first, activate it, republish, then change only that domain's destination. `/login` redirects to the new central studio login. Retain the previous destination and old app for rollback.

## Capacity and continuing operation

This setup has not been load-tested on the real VPS and does not make 100 GB enough for 400 full portfolios. Monitor actual media, release history, database and backup growth. The earlier 400 GB estimate remains a planning figure for the new workload; include old sites retained alongside it. No hosting or storage upgrade has been purchased. Free email/AI quotas and hardware limits still apply.

The local tool environment has no Docker engine; the CI gate and server acceptance checks are required. The deployment files do not promise zero downtime or protection from every attack. Keep agency accounts, backups, monitoring and OS maintenance under an identified operator.

References: [EasyPanel domain destinations](https://easypanel.io/docs/services/app#domains), [Docker bounded build driver](https://docs.docker.com/build/builders/drivers/docker-container/), [Caddy trusted proxies](https://caddyserver.com/docs/caddyfile/options#trusted-proxies).
