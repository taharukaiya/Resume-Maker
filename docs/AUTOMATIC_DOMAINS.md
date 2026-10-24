# Automatic domain setup on the VPS

The studio separates **Prepare domain** from **Go live**. Adding a domain or preparing it never switches website traffic. Domain registration remains separate.

## Admin workflow

1. Add a domain you own. The studio suggests `researchby<first-name>.com`; change it as needed.
2. Select **Prepare domain**. The host checks access to the Hostinger DNS zone, saves a private DNS snapshot, and appends the `_brilliancy` ownership TXT record. Existing website and email records stay in place. Verification runs automatically.
3. Review and publish the latest portfolio at its shared address. Preparation alone does not publish content.
4. When the hosting administrator has approved that specific domain, **Go live** becomes available. Confirm the displayed address. The host checks for conflicts, adds compatible website DNS, waits for propagation, configures HTTPS and the root-to-`www` redirect, then publishes the already reviewed release at the new address.

Go live is disabled by default. Existing website DNS or proxy routes are never taken over by this workflow, even when a domain is allowlisted. Migrating a legacy portfolio requires a separately reviewed cutover and rollback plan. Other portfolios and email records must not be changed.

Automatic preparation currently supports a two-label registered domain such as `example.com` with its `www` alias, in a DNS zone accessible through the connected Hostinger account. Multi-level registered domains, other subdomains, and external DNS providers use the collapsed manual instructions. A token does not purchase domains or change nameservers.

## Connect Hostinger securely

Create a dedicated expiring token in Hostinger's **Dev tools → API → API tokens**. Select DNS-only access if the account offers that restriction. Keep the token in a password manager. Never paste it into chat, source code, a command argument, or the studio.

On the VPS, run interactively as root:

```sh
python3 /opt/brilliancy/scripts/configure-hostinger.py
```

Paste the token only at the hidden prompt. The helper writes a regular root-owned file with mode `600` at `/etc/brilliancy-hostinger.token`. It does not call the provider or change DNS. The reconciler reads this file on the host; web and worker containers never receive the token. Never run `cat` on the token file or print its value while troubleshooting.

The host service uses `/etc/brilliancy-domains.env`:

```dotenv
BRILLIANCY_ROOT=/opt/brilliancy
BRILLIANCY_VPS_IP=187.127.210.231
HOSTINGER_API_TOKEN_FILE=/etc/brilliancy-hostinger.token
BRILLIANCY_GO_LIVE_DOMAINS=
```

Use the actual VPS public IP. Keep the launch allowlist empty during testing. In `deploy/vps/.env`, keep `DOMAIN_GO_LIVE_ENABLED=false`. These are independent application and host launch gates; a browser request cannot enable them.

Install the supplied `brilliancy-domains.service` and `.timer` under `/etc/systemd/system/`, then reload systemd and enable the timer. On an existing installation, stop only this timer while deploying a version that changes its worker CLI, update web and worker together, and restart the timer afterward. Do not restart Docker or unrelated services. The service requires the installation's existing Compose project configuration and writable owned proxy directories.

The studio receives a short-lived host heartbeat describing availability, token-file configuration, and approved domains. “Connected” configuration means a private token is present; actual provider authorization is tested during preparation. Missing/expired tokens or inaccessible zones produce a safe error without exposing the token or provider response body. Refresh status after setup.

## Future launch approval

After content, backups, DNS snapshots, and rollback have been reviewed, the hosting administrator may enable `DOMAIN_GO_LIVE_ENABLED=true` for the web/worker deployment and add an exact registered domain to `BRILLIANCY_GO_LIVE_DOMAINS` in the host service environment. The next service run reports that approval. This only enables the admin's separate **Go live** action; it does not queue a launch itself. Leave all unapproved domains out of the allowlist.

Existing root/www A, AAAA, or CNAME records that conflict with the intended address block automation. Existing legacy proxy routes also block it before any website DNS write. Do not remove these protections to migrate sites in bulk.

Private DNS snapshots are kept under `/var/lib/brilliancy-domains/dns-backups`. They record the prior DNS zone, not website content. They are not an off-server backup. Preserve them with the cutover plan; restoring DNS requires deliberate review. A removed studio domain does not delete its public TXT proof or provider records.

## Rotation and recovery

Run the hidden-input helper again to replace a token, verify a preparation request, then revoke the old token in Hostinger. After restoring a VPS, recreate or securely restore the host token separately; application backups do not include this host-only file. Do not enable launch gates as part of credential recovery.

Safety checks: `python3 tests/test_hostinger_dns.py`, `python3 tests/test_domain_reconcile.py`, `npx vitest run tests/domain-management.test.ts`, and `npx playwright test tests/browser/domains.spec.ts`.
