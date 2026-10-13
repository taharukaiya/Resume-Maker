# Pre-deployment audit — 13 October 2026

**Decision: stage and verify on the new VPS before switching any existing live domain.** This is a code review and local verification record, not a penetration-test certificate or a guarantee against all attacks.

## Problems fixed

- Production startup previously required AWS S3. Explicit VPS mode now supports persistent local storage while requiring PostgreSQL, HTTPS, a separate media origin, email configuration and malware scanning. AWS requirements remain in place for AWS mode.
- Added a Compose deployment with Caddy HTTPS, private database/scanner ports, separate web and worker processes, a restricted runtime PostgreSQL role, non-root read-only app containers, bounded container logs and a web health check. No cPanel is needed.
- Added per-request nonce CSP for admin/authentication pages, no-store responses and no-referrer handling for sensitive setup/reset links. Public portfolios keep their separate script-free policy.
- Added upload throttling and proxy-address login throttling for the supplied VPS topology. The proxy overwrites the identifying header, and the application port is not publicly mapped.
- Corrected the portfolio CSP to allow its contact form to submit to the configured studio origin from a researcher domain.
- Corrected main sitemap entries to use each published canonical address.
- Added explicitly verified/activated VPS domain routing and a server-operator command that generates the domain configuration. Researcher hosts route only to portfolio content.
- Added optional release retention. The VPS configuration retains three publications and queues obsolete release files for deletion; the active release and editing revisions remain. VPS public pages use the committed database publication as their source of truth rather than an independently written live-manifest file.
- Replaced the public-facing AWS/demo deployment guide with an authenticated, task-focused workspace guide. Corrected outdated README claims and deployment links.
- Excluded nested environment files from Docker build context. Verified that tracked files include `.env.example`, not the actual environment or `hostinger.txt`.
- Added confirmation-safe backup tooling, configuration generation, a capacity estimate and a staged cutover/restore guide.
- Hardened public route lookup so prototype-property names are treated as missing pages rather than causing server errors.

## Existing controls reviewed

Parameterized database queries; strict content validation; HTML escaping and URL validation; server-side tenant and field permissions; password hashing; hashed session/reset tokens; secure production cookies; administrator MFA checks; origin validation for authenticated mutations; single-use reset/invitation links; bounded request bodies; file-signature checks; limited decoded image size; production malware scanning; private originals and isolated published media; publication snapshots; queued background jobs; audit records; and concurrency checks for draft saves/deletion.

These controls reduce specific risks. Their presence is not proof against every attack. Public inquiry forms intentionally accept cross-origin submissions from portfolio websites and use validation, honeypot and rate limits instead of the studio-only origin check.

## Verification record

- TypeScript checking and the final optimized Next.js production build passed, including the VPS researcher-domain route and nonce proxy.
- Initial baseline: 111 unit/integration tests passed.
- Expanded suite: 120 unit/integration checks passed across the full run and the corrected nonce-assertion rerun. Includes real isolated PostgreSQL-compatible database/auth/media/publication workflows, release cleanup, verified domain routing, and production configuration boundaries. The route-lookup regression was checked separately after hardening.
- Fifteen standard browser scenarios passed across the full run and targeted reruns. Coverage includes all six curated designs, mobile layouts, hamburger menus, reduced motion, keyboard confirmation behavior, permission-restricted client updates, CV fill workflow with controlled fixtures, portraits, favicon/title behavior, publication, deletion, links and contact submissions.
- The first browser run was interrupted after local memory pressure from two development servers. The user's local server was temporarily stopped for isolated testing. Two stale browser tests were corrected: education is mandatory before publishing, and the permission checkbox must be located by its role rather than an ambiguous shared field label.
- The optional real MODNet model-download browser test was skipped. Controlled AI fixtures do not establish live provider reliability or CV factual accuracy.
- npm audit reported **zero known advisories**, including development dependencies, at the time of this review. TLS certificate verification remained enabled; Node’s system certificate store resolved the local certificate-chain issue.
- Shell syntax was checked with Bash. Local Docker is unavailable; Linux container, Compose, Caddy and real PostgreSQL startup validation are included in the new CI job and must be green before deployment.
- Browser scenario assertions completed, but the Windows test runner required stopping during server teardown. This is recorded separately from application assertion results.

## Launch gates requiring the agency/server

1. Confirm the actual VPS plan, IP, OS, installed services and available resources. `hostinger.txt` contains account login details, not this information.
2. Clarify the instruction involving the 11 October deployment and list the domains that must remain live. Do not change their DNS before approval and a rollback plan.
3. Require green CI on the exact deployment commit, including the Linux image/startup job. Complete a real VPS startup and container restart test. Production build success alone is insufficient.
4. Verify firewall exposure, DNS, certificate issuance/renewal, private-media denial and administrator MFA on the real hosts.
5. Test ClamAV with benign and EICAR test files, real invitation/recovery email, real AI extraction/summary, and the chosen browser hardware where applicable.
6. Complete an encrypted off-server backup and restore drill. Preserve the session encryption secret when restoring MFA-enabled accounts. No backup restoration was performed against the real agency environment here.
7. Decide how any existing portfolios and files will be migrated. A fresh installation starts empty; JSON export is not a database-and-files backup.
8. Configure monitoring, patching, disk/backup alerts and an incident owner. Run a controlled load test on the chosen plan. The storage recommendation is a capacity estimate, not a 400-user concurrency benchmark.
9. Review AI data handling and the agency’s privacy/retention notices before uploading real client documents. Registrations and renewals for researcher domains are separate from VPS space.

There is no volumetric-DDoS guarantee or high availability on one VPS. Add edge protection with correctly configured trusted-proxy handling, independent backups and recovery procedures. Do not cache authenticated pages or API responses at a CDN.

The step-by-step commands, purchase estimate and boss-facing information request are in [Hostinger VPS launch](HOSTINGER_VPS_LAUNCH.md).
