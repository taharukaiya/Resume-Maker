# Production readiness and researchby migration

Review date: 24 October 2026. This is a scoped engineering review, not a penetration-test certification or a guarantee that no vulnerabilities exist.

## Decision

**Do not switch the existing researchby domains yet.** The application supports verified custom domains and a central studio, but source-content migration and production acceptance are still required. No DNS, proxy routes, or existing portfolio content were changed during this review.

The signed-in live studio at `studio.researchbyshiba.com` listed only **Rukaiya Taha**, a draft, during this review. It did not contain reviewed replacements for the 29 domains listed below. Changing routing now could replace working sites with missing or incorrect content.

## Address and login design

Use a company-controlled central studio, ideally `studio.brilliancy-research.com` if that is the company's approved brand/domain. That parent domain appears active in Hostinger; the proposed studio subdomain's DNS, certificate, and routing have not been configured or verified. `brilliancyresearch.net` was pending. Do not assume ownership or availability of `brilliancyresearch.com`.

- Public portfolio: `https://www.researchbyshaila.com/`.
- Bare domain: redirects to the canonical `www` address, preserving the path.
- Personal login shortcut: `https://www.researchbyshaila.com/login` redirects to the central studio's `/login`.
- Authentication uses one origin and host-only secure cookies. Personal domains must not receive or forward studio cookies.
- Administrators manage all portfolios. Client accounts see only the portfolios assigned to them and can edit only permitted fields. A domain name alone grants no account access.

The existing `/website/[hostname]/[[...path]]` handler already requires a verified, activated domain and implements the login shortcut without forwarding query strings. The VPS proxy strips cookies on researcher routes. Do not implement separate passwords or shared wildcard cookies for each public domain.

When moving the studio, update its configured `APP_URL`/`STUDIO_HOST`, public media origin if needed, reverse proxy and TLS. Keep the existing database, uploads, and `SESSION_SECRET`. Test CSRF checks, invitations, password recovery, and fresh login on the new origin. Existing sessions are scoped to the previous hostname; users will need to sign in again. Keep a temporary redirect from the old studio so bookmarks and outstanding emailed links continue to work.

## Changes made in this review

| Finding                                                                                                   | Change                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.4.0 had critical/high npm advisories                                                           | Updated to 16.4.3.                                                                                                                                                                        |
| Zod had a collection-validation denial-of-service advisory                                                | Updated to 4.6.7.                                                                                                                                                                         |
| Vitest mocker had development-tool advisories                                                             | Updated to 4.1.12.                                                                                                                                                                        |
| Changing a password left outstanding account-recovery links usable                                        | Password change now invalidates outstanding account tokens as well as other sessions.                                                                                                     |
| Upload deletion was hard to find and permanently removed source files needed by history or in-flight work | Added contextual document/image removal and restoration, plus a direct removal button beside the CV selection. Database migration `011_removed_uploads.sql` adds recoverable removal.     |
| File deletion checked draft references outside the save transaction                                       | Removal now locks the portfolio row, serializing with draft saves and publish requests. Saved references cannot be removed. Removed files cannot be selected by new saves until restored. |
| Test suite depended on leftover output folders and obsolete Contact copy                                  | Tests now create their output directories and assert the current Contact label.                                                                                                           |
| Settings incorrectly claimed agency credit would be published                                             | Corrected the settings description and save message.                                                                                                                                      |

Removal is **recoverable**, not physical erasure. It hides an upload from selectors and private download access, retains original bytes for restoration and history, and does not reclaim storage. Published releases have separate asset copies. To take already-published content offline, edit/unpublish and use the documented release-retention workflow; removing an upload is not a privacy-erasure operation.

## Security controls inspected

- Parameterized SQL for application inputs; dynamic query fragments reviewed here are fixed application strings.
- Server-side portfolio ownership, administrator role, field permissions and media ownership checks.
- Same-origin validation for authenticated mutations; public inquiry endpoint intentionally accepts public submissions with limits.
- Opaque hashed sessions, HttpOnly/SameSite cookies, secure production cookie configuration, scrypt passwords, rate limits, and optional TOTP with replay protection.
- Validated document schema and safe HTML rendering; CSP, anti-framing, content-type and production HTTPS headers.
- Upload size/type validation, image re-encoding, production malware scanning, private originals, separate public asset origin, Word conversion timeout and macro-disabled profile.
- Production config rejects missing scanner/database/secrets/HTTPS origins; container config has non-root application execution, resource limits, read-only roots and reduced privileges.

These checks do not replace live network verification or independent security testing. In particular, LibreOffice/PDF parsing remains a resource-sensitive attack surface; run only supported patched images and test malicious-file rejection with the real scanner.

## Local verification

- `npm audit`: zero known vulnerabilities after updates (including development dependencies).
- `npm run typecheck`: passed.
- `npm test`: 208 tests passed across 33 files. Includes SQL-looking input, disguised executable uploads, anonymous/client access denial, origin checks, draft protection, removal/restoration and password-recovery token invalidation.
- Browser acceptance: upload removal/restoration with unsaved edits preserved, 390 px mobile layout, login password controls, and paired-domain instructions passed (7 checks).
- Additional publishing/scale and production-build results are recorded below when completed.

Tests use isolated synthetic data. Production AI extraction, email delivery, malware scanning, TLS issuance, backup restoration and simultaneous traffic across hundreds of portfolios were not established by those tests.

## Outstanding launch gates

1. **Deploy the patched build and migration to the demonstration installation**, then repeat acceptance there before changing public portfolio routes. A Git push alone does not deploy the VPS. Run migration with the existing migration service/credentials before starting code that queries `removed_at`; do not rerun initial configuration or reset the database.
2. **Secure management access.** The observed EasyPanel tab uses plain HTTP on public port 3000. Configure an HTTPS management hostname and restrict direct management-port access using a verified recovery path. Enroll the administrator in MFA (the live studio currently offers setup); credential/MFA entry is performed by the account holder. Do not lock out the operator during firewall changes.
3. **Back up and restore-test both systems.** Preserve the legacy applications, databases, uploads, environment/configuration and router rules. Keep an encrypted off-server backup and prove restoration on an isolated target. A backup command or VPS snapshot without a restoration test is not sufficient evidence.
4. **Import and review all legacy content.** Obtain exports/original uploads, create each portfolio and assign the correct client. Compare biography, portrait/CV, article counts, authors/dates/abstracts, images/captions, downloads and old URL paths. Preserve manually edited content. Do not fabricate missing author/domain mappings or overwrite reviewed drafts.
5. **Verify deployed services.** Exercise real PDF and DOCX uploads, extraction and review without auto-publishing; inspect website/PDF output; send a test invitation/recovery email with authorization; verify scanner rejection, worker recovery and persistent storage after restart.
6. **Size and load-test.** Current allowance is 100 MB of original/extracted media per portfolio, including removed uploads. 200+ PDF articles can exceed this. Measure representative originals, figures, generated releases and backups, choose a quota/storage policy and run realistic concurrent upload/publish/browse tests before promising 300–400 portfolios. Local archive pagination tests are not a production capacity certification.
7. **Pilot one reviewed portfolio.** Record and back up its exact old router rules, connect/verify the domain, test HTTPS on root and `www`, `/login`, client isolation, links, inquiry form, mobile layout and PDFs. Switch only its explicit host routes. Watch errors and have a tested switch-back procedure before repeating for others.

## Exact domain scope observed in Hostinger

Source: signed-in Hostinger VPS DNS Manager for VPS 1859217, all 35 rows on one page. **29 matching roots**, all shown Active. Active DNS management is not evidence that website routing or TLS is ready. Each needs an explicit portfolio mapping and reviewed content before activation.

```text
researchbyshaila.com
researchbyshiba.com
researchbylayla.com
researchbyrubayet.com
researchbyraisa.com
researchbybrishty.com
researchbyshihab.com
researchbyshahadat.com
researchbyazam.com
researchbymahbuba.com
researchbyadib.com
researchbynazifa.com
researchbysanowara.com
researchbymeftahul.com
researchbysohi.com
researchbyrana.com
researchbynoyon.com
researchbyimrana.com
researchbyrashadul.com
researchbyrayna.com
researchbyarif.com
researchbyzahangir.com
researchbysumaia.com
researchbyshila.com
researchbysharminjahan.com
researchbyfouzia.com
researchbyporag.com
researchbymuhtasim.com
researchbyrokonuzzaman.com
```

Excluded from portfolio replacement: `brilliancyresearch.net`, `sadiaresearchhub.com`, `sabbirresearchhub.com`, `ruhulresearchhub.com`, `brilliancy-research.com`, and `brilliancyabroad.com`. A new central studio subdomain on an approved company domain is a separate change, not permission to replace that company's website.

Preserve MX, mail TXT/SPF/DKIM/DMARC, nameservers and unrelated subdomain records. Since the VPS already hosts other applications, a DNS A-record update alone may not be the migration: existing EasyPanel host rules may already point to this VPS and must be moved one domain at a time. Never remove the shared proxy or replace all routes with a wildcard for this migration.
