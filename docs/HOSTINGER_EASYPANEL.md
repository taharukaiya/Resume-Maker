# The agency's EasyPanel VPS: deployment walkthrough

This is the guide for the server inspected on 13 October 2026: Ubuntu 24.04, EasyPanel 2.32.1, Docker 29.6.1, Compose 5.3.0, 2 cores, about 7.8 GiB RAM and 85 GB disk available. Existing sites run in Docker Swarm. The `easypanel` overlay is attachable and already contains `easypanel-traefik`.

Use **easypanel** mode below. The earlier **existing** mode is for a host-installed proxy and is not the correct configuration for this server.

## How it will connect

EasyPanel will retain public HTTP/HTTPS and certificates. Two new domain entries will send traffic to `http://brilliancy-portfolio-gateway:8080/` on its existing overlay. Only our gateway joins that network; our PostgreSQL, scanner, worker and web application stay on their own Compose network. No additional host ports are published. There is no need to edit the running Traefik service or buy an EasyPanel licence for this terminal-managed installation. It is managed with Docker Compose in the terminal, not as a native EasyPanel project card.

The pilot caps total steady-state container memory at 4.5 GiB: web 640 MiB, worker 512 MiB, database 256 MiB, scanner 3 GiB, gateway 128 MiB. The migration container runs separately before web/worker. Limits are ceilings, not reserved/guaranteed available RAM. This is a constrained test deployment, not validated capacity for 400 portfolios. ClamAV's documented minimum is 3 GiB and preferred allocation is 4 GiB. Keep scanning enabled; if signatures, scans or large uploads fail within the budget, stop the pilot and reassess capacity rather than removing security checks. [ClamAV memory guidance](https://docs.clamav.net/manual/Installing/Docker.html)

## 1. Prepare accounts and backups

- Confirm an off-server backup of the existing websites, databases and EasyPanel configuration is available before installation. A displayed weekly schedule alone does not establish that restoration works.
- Approve two unused subdomains, for example `studio.brilliancyresearch.net` and `media.brilliancyresearch.net`. These are proposed names, not automatically created DNS records.
- Follow [Free services setup](FREE_SERVICES_SETUP.md) to create a Resend Free sending key, verify an unused sending subdomain, and create a private Gemini API key for a Free-tier project. Keep both services on their Free tiers. Browser AI is an opt-in alternative with hardware/download requirements.
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

Ensure these settings are present; the script sets the provider/model defaults, and you supply the private keys:

```dotenv
COMPOSE_FILE=compose.yaml:compose.easypanel.yaml
EMAIL_PROVIDER=resend
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=YOUR_PRIVATE_GEMINI_KEY
```

Replace the Gemini key placeholder with your private key, add `RESEND_API_KEY`, and confirm `EMAIL_FROM` belongs to your verified sending domain. Keep the generated `EASYPANEL_PROXY_CIDRS`, database passwords and session secret. Save in nano with **Ctrl+O**, Enter, then **Ctrl+X**. Do not paste the file into chat or run unredacted `docker compose config`.

Gemini 3.5 Flash-Lite currently has free input/output on the Free tier, subject to project/model quotas. Keep paid billing disabled for this setup; configuration changes do not change Google billing. Quota exhaustion can temporarily block AI operations. See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Free services setup](FREE_SERVICES_SETUP.md) for setup and data-use details. To explicitly choose browser AI instead, set `AI_PROVIDER=huggingface-browser`; it is not an automatic fallback. Existing environment files are not overwritten by the new defaults.

If the application is already running and you are only switching its AI provider to Gemini, edit the existing `.env` as above and apply it with:

```bash
cd /opt/brilliancy/deploy/vps
docker compose config --quiet
docker compose up -d --no-build --force-recreate web worker
docker compose ps
```

This provider switch requires no image rebuild or database migration. Once the web service is healthy, test CV extraction and article summarization. The remaining build/start steps are for first installation or application code updates.

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
| Preserve original Host      | Required; apply the separate routing file below on 2.32.1  |

Both public names use the same destination. The gateway distinguishes studio from media by hostname. EasyPanel's form labels vary by version; if it does not offer a custom destination, send that form's screenshot before saving. Do not select `education_web-master` as the target. Do not enable caching on the studio/API route. Keep request body limits at least 22 MB and upstream timeouts at least 120 seconds if overriding them. Existing Traefik must sanitize incoming forwarded headers; do not enable `forwardedHeaders.insecure`. The gateway uses right-to-left forwarded-IP parsing and trusts only the configured overlay CIDR, overwriting user-supplied `X-Brilliancy-IP`.

### Preserve the hostname with EasyPanel custom destinations

The inspected EasyPanel 2.32.1 installation generates `passHostHeader: false` for custom destinations. This makes Caddy receive `brilliancy-portfolio-gateway` as the host and return its fallback 404, even when the application and TLS are healthy. There is no preserve-host switch in the inspected domain form. Do not edit generated `main.yaml`; EasyPanel can overwrite it.

Use [the separate Traefik configuration template](../deploy/vps/traefik.easypanel.yaml.example). Replace `studio.example.test` and `media.example.test` with the exact configured names. Install the completed file as `/etc/easypanel/traefik/config/brilliancy-host-routing.yaml`, checking that this filename is unused first. Prepare it outside the watched config directory, then move it into place so Traefik never reads a partially written file. Keep this file in the server configuration backup.

The template adds one HTTPS router scoped to those two hosts and a distinct service with `passHostHeader: true`. Priority 100 outranks the inspected generated routes (priority 0, whose effective priority is their shorter rule length). It reuses the observed `https` entrypoint and `letsencrypt` resolver. Keep the existing EasyPanel domain entries for their HTTP-to-HTTPS redirects. Other domains do not match this route. Confirm entrypoint/resolver names and competing priorities before using the template on a different installation.

Wait a few seconds for Traefik's file watcher, then run:

```bash
curl -i --max-time 20 https://YOUR_STUDIO_HOST/api/status
curl -I --max-time 20 https://YOUR_STUDIO_HOST/login
curl -i --max-time 20 https://YOUR_MEDIA_HOST/private/test.pdf
```

Expect status 200 with JSON for `/api/status`, a working login page, and 404 for private media. If these still fail, inspect recent Traefik logs and whether the file provider watches this directory before scheduling a shared-proxy restart. EasyPanel's general guide suggests a restart, but avoid restarting the shared proxy automatically during this pilot. To roll back, move only `brilliancy-host-routing.yaml` out of the config directory and recheck; never remove `main.yaml` or unrelated custom files.

The custom file is independently managed: later host, destination or middleware changes in EasyPanel's form do not update this higher-priority route. Update or remove the corresponding custom rule too. For each future portfolio domain, explicitly add its approved hostname to the rule (or use a separate uniquely named router/service with `passHostHeader: true`) only after its internal Caddy route and DNS are ready. Do not use a catch-all public host rule.

References: [EasyPanel custom configuration](https://easypanel.io/docs/guides/custom-traefik-config), [Traefik host forwarding](https://doc.traefik.io/traefik/reference/routing-configuration/http/load-balancing/service/).

Check in the browser:

- `https://YOUR_STUDIO_HOST/login` loads with a valid certificate.
- `https://YOUR_STUDIO_HOST/api/status` responds.
- `https://YOUR_MEDIA_HOST/private/test.pdf` returns 404.
- All old researcher websites still load.

Do not expose the gateway on the server's public port 8080/8088 if routing fails. Confirm the domain spelling, overlay membership and destination using logs instead. Adding the new route does not require replacing the current Traefik service or proxy configuration.

## 7. Bootstrap and test

Privately read `SETUP_TOKEN` from the server `.env`, open the studio `/setup?token=...` URL, create the administrator and enable authenticator MFA. Clear the setup token afterward and run `docker compose up -d --no-build web worker`.

Create a disposable test portfolio and a test client. Test login/MFA, email invitation and recovery, field permissions, image/CV/article uploads, actual malware scanning, the configured AI provider, publishing, mobile layouts and inquiry delivery to the inbox. Review extracted facts. Confirm an uploaded file and login survive a container restart. Complete an off-server backup/restore test before client use; `backup.sh` covers only this application, not existing Swarm services or EasyPanel's proxy/TLS configuration.

Do not migrate `researchbytresna.com` or any current client yet. A fresh database has none of their existing content or accounts. When an individual portfolio is approved for migration, use the custom-domain steps below. Retain the previous destination and old app for rollback.

## 8. Make an owned domain the portfolio's website address

An administrator can choose a connected domain in the portfolio's **Website address** tab, click **Save website address**, then return to **Review & publish** and republish so the site's links and canonical URL use that address. The **Manage website address** button in Review & publish opens the same tab. For example, a connected root domain serves its portfolio at `https://portfolio.example.test/`, without `/portfolio/SLUG`. `portfolio.example.test` is an illustrative placeholder in the commands below: replace it with the exact registered domain you own. Adding or selecting a name in the admin panel does not register it, buy it, change DNS, issue its certificate, or reconfigure EasyPanel.

This flow keeps hosting changes in the operator's terminal and EasyPanel account. The web application does not need the Docker socket or permission to edit the shared proxy. Only administrators can select the website address; clients cannot change it. A domain must be verified and activated before it can be selected. Operator activation makes it eligible but does not silently change the selected address.

### Confirm ownership and prepare the portfolio

The editor automatically suggests `researchby<first name>.com` in **Review & publish** and **Website address**. For example, a portfolio named “Rukaiya Taha” suggests `researchbyrukaiya.com`. This is a proposed name, not a checked or reserved domain. Each chosen `.com` needs its own registration; the app does not create free subdomains or purchase domains automatically. Renaming a portfolio can change its suggestion, while its saved website address stays unchanged.

1. Search for the suggested name at your domain provider. If it is available and you want it, register that exact domain separately; if it is unavailable, choose another name you can register or already own. Confirm that the domain appears in your account and that you can manage its authoritative DNS. The suggestion's availability and ownership are not guaranteed.
2. If the domain already serves a website, record its current DNS and EasyPanel destination, back up that website, and agree on the change window. Changing the root `@` record or proxy destination moves that website's public traffic.
3. Publish and review the portfolio at its included shared address first. Open **Website address → Connect a personal domain**. Click **Use suggested name** to fill the Domain name field, or type the exact domain you registered. This button only fills the field. Click **Add domain** to begin verification. Enter the root hostname without a page path; a full HTTPS address ending at `/` is also accepted.
4. Add the TXT record displayed by the editor at the domain's DNS provider, then click **Verify DNS record**. Keep this ownership record. Verification alone does not move visitors. Apex and `www` are separate hostnames; configure and verify each host that will serve a portfolio, or configure a deliberate `www` redirect separately.

### Install the internal route on this EasyPanel VPS

Run from the deployment directory, using the verified domain in `DOMAIN`. The installed application image and database migrations must match the release being deployed. Generate a temporary file first; the command only prints Caddy configuration and never edits the proxy itself:

```bash
cd /opt/brilliancy/deploy/vps
DOMAIN=portfolio.example.test
pending_route=$(mktemp)
docker compose exec -T web node node_modules/tsx/dist/cli.mjs scripts/vps-domain.ts config "$DOMAIN" > "$pending_route"
cat "$pending_route"
```

Check that generation succeeded and the first line is `http://YOUR_DOMAIN:8080 {`. It must route to this app's `web:3000`, and must not claim public TLS ports. Review any existing `domains/$DOMAIN.caddy` before proceeding. For a new route:

```bash
test ! -e "domains/$DOMAIN.caddy" &&
mv -- "$pending_route" "domains/$DOMAIN.caddy" &&
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile &&
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

If validation fails, move only the newly added file back outside `domains`, correct it, and validate again. The running Caddy configuration stays in use until a successful reload. Do not restart the shared EasyPanel proxy or expose public port 8080/8088 for this step.

### Connect DNS, HTTPS and the preserved hostname

At the agreed change window, point only the approved domain's web record to the VPS. For a root domain this is normally an `A` record named `@`; for a subdomain use its DNS label. Review an existing `AAAA` record too: it must reach the same service, or IPv6 visitors may reach the previous host. Keep mail/MX records and unrelated hosts unchanged. If the domain already points here, only its proxy destination may need changing.

In **EasyPanel → Domains**, create or update this exact hostname with **HTTPS enabled**, public path `/`, and custom destination **`http://brilliancy-portfolio-gateway:8080/`**. Record the previous destination if replacing a live site. Retain the HTTP-to-HTTPS redirect. The custom domain uses the same private gateway as studio/media; it does not use the studio URL as an upstream.

This EasyPanel version also needs an exact-host Traefik rule with `passHostHeader: true`, as described in section 6. Either add only the verified hostname to the existing managed preserve-host rule, or install a separate file with unique router/service names. For example, after replacing the placeholder hostname and choosing unique names:

```yaml
http:
  routers:
    brilliancy-portfolio-example:
      rule: "Host(`portfolio.example.test`)"
      entryPoints:
        - https
      priority: 100
      service: brilliancy-portfolio-example
      tls:
        certResolver: letsencrypt
  services:
    brilliancy-portfolio-example:
      loadBalancer:
        passHostHeader: true
        servers:
          - url: http://brilliancy-portfolio-gateway:8080/
```

Prepare the completed YAML outside `/etc/easypanel/traefik/config/`, then move it atomically to a new, unused `.yaml` filename inside that directory. Confirm its priority exceeds the generated route for this hostname, and that the observed `https` entrypoint and `letsencrypt` resolver still apply. Never replace generated `main.yaml`, reuse another portfolio's router/service name, or use a catch-all hostname rule. Keep the file in the proxy configuration backup. Verify Traefik accepted it and the certificate covers the exact host. Until activation, this domain can return an application 404 even when the route and TLS are correct.

### Activate, select, then republish

Once the domain's DNS and HTTPS route are ready, activate its verified application mapping:

```bash
docker compose exec -T web node node_modules/tsx/dist/cli.mjs scripts/vps-domain.ts activate "$DOMAIN"
curl -I --max-time 20 "https://$DOMAIN/"
curl -I --max-time 20 "https://$DOMAIN/login"
```

The homepage should return 200 for the already published portfolio. `/login` should redirect to the central studio login, without granting access or creating a separate admin account. A failed certificate or request is a hosting problem to resolve before selecting this address. A queued or running publish job blocks activation/deactivation; wait for it to finish and retry.

Return to the **Website address** tab, refresh its connected-domain status, choose the connected domain under **Public website address**, and click **Save website address**. Then open **Review & publish**, publish again, and wait for publishing to finish. Selecting an address changes the next publication's URL; it does not rewrite an already generated release immediately. Check the displayed published address, homepage, every navigation link, media, canonical URL and contact form. The default shared address remains available; changing the selected address does not register, transfer or delete a domain.

To return to the included address, select **Shared address** in the **Website address** tab, click **Save website address**, and republish. To retire a domain completely, wait for publishing to finish, then deactivate it:

```bash
docker compose exec -T web node node_modules/tsx/dist/cli.mjs scripts/vps-domain.ts deactivate "$DOMAIN"
```

Deactivation clears that domain's primary selection. Select the included address or another connected domain and republish. Remove only the retired hostname's Caddy route and managed Traefik rule, validate/reload Caddy, and update its EasyPanel/DNS destination as planned. If this was a migration rollback, restore that hostname's recorded previous destination and retain the old site and data. Recheck the studio, media host and other existing websites after changes.

## Capacity and continuing operation

This setup has not been load-tested on the real VPS and does not make 100 GB enough for 400 full portfolios. Monitor actual media, release history, database and backup growth. The earlier 400 GB estimate remains a planning figure for the new workload; include old sites retained alongside it. No hosting or storage upgrade has been purchased. Free email/AI quotas and hardware limits still apply.

The local tool environment has no Docker engine; the CI gate and server acceptance checks are required. The deployment files do not promise zero downtime or protection from every attack. Keep agency accounts, backups, monitoring and OS maintenance under an identified operator.

References: [EasyPanel domain destinations](https://easypanel.io/docs/services/app#domains), [Docker bounded build driver](https://docs.docker.com/build/builders/drivers/docker-container/), [Caddy trusted proxies](https://caddyserver.com/docs/caddyfile/options#trusted-proxies).
