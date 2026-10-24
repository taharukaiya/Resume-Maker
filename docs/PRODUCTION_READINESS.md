# Production readiness and researchby migration

Review date: 24 October 2026. This is a scoped engineering review, not a penetration-test certification or a guarantee that no vulnerabilities exist.

## Decision

**Do not switch the existing researchby domains yet.** The application and permanent studio have passed the checks below, but off-server backup storage and reviewed legacy replacements are still required. No existing portfolio domain routes, apex/www records, mail records or portfolio content were migrated. Only the approved studio subdomain and its old-address redirect were configured.

The signed-in live studio at `studio.brilliancy-research.com` lists only **Rukaiya Taha**, a draft. It does not contain reviewed replacements for the 29 domains listed below. Changing routing now could replace working sites with missing or incorrect content.

## Address and login design

The approved central studio is **https://studio.brilliancy-research.com**. Its A record, valid HTTPS, host routing, same-origin mutations and a fresh administrator sign-in were verified on 24 October. The parent company's website and mail records were preserved. The old demo studio redirects with HTTP 302, preserving paths and query strings for existing bookmarks and account links.

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
- `npm test`: 213 tests passed across 34 files. Includes SQL-looking input, disguised executable uploads, anonymous/client access denial, origin checks, draft protection, removal/restoration, password-recovery token invalidation, upload capacity and caption/abstract separation.
- Browser acceptance: all **29 enabled checks passed** in the full GitHub run. The optional real MODNet download test remains opt-in and was skipped. Coverage includes upload removal/restoration with unsaved edits preserved, 390 px mobile layout, login password controls, paired-domain instructions, stale response protection, client invitations and field permissions, private drafts, public inquiries, publishing, article metadata/figures/PDF controls, selective CV review and a 250-article archive.
- `npm run build`: passed with Next.js 16.4.3. Browser assertions were updated to the current fixed design, navigation and required-field labels; an isolated client-flow rerun also passed with its setup fixture.

Tests use isolated synthetic data. Additional real-service verification is recorded below; it does not establish capacity for hundreds of simultaneous active users.

## CI maintenance and editor regression

[GitHub Actions run 82](https://github.com/taharukaiya/Resume-Maker/actions/runs/40079893366) passed both `verify` and `vps-image` for application commit `b6d518c`. It passed 213 unit/integration tests, 29 browser tests (one optional model-download test skipped), TypeScript, the production build, production dependency audit, container startup/migrations and proxy-isolation checks. Earlier failed runs remain in history.

Recent GitHub Actions failures included browser assertions for the retired template picker, outdated labels/navigation, a fixture without its About section, and repeated sign-ins hitting the real login rate limit. Tests now follow the current fixed design and reuse authenticated test sessions while dedicated login tests still exercise authentication. Production rate limits were not disabled. The workflow uses maintained v7 GitHub actions, pins Ubuntu 24.04, checks every VPS shell script and cancels superseded verification runs.

A delayed initial editor response could replace a newer draft under overlapping loads. The editor now ignores responses from a superseded initialization. A browser regression holds the older response until after a biography edit, then verifies that the edited biography survives and is saved. The local regression, all three domain checks and the full multipage editing/publishing/inquiry flow passed in focused runs. TypeScript checking passed after stopping the development server to avoid concurrent changes to generated route types.

## VPS verification

Latest deployed application image: **`brilliancy:b6d518c6163a`**. Web and worker were running after activation; web health and HTTPS login checks passed, and the existing administrator session still loaded the overview. The live draft and existing uploads were preserved. This includes the final matching serif caption typography and stale editor-response protection.

- An isolated acceptance project used the production image, PostgreSQL, real LibreOffice/PDF extraction, the live AI provider with synthetic documents, and ClamAV. PDF and DOCX both retained the original abstract, two authors, publication date, body headings and separate paragraphs. Figure captions were attached by image ID. Review edits to authors and captions appeared in both website HTML and downloaded PDFs. Extraction did not publish or overwrite an existing draft.
- Fixed a caption adjacent to an abstract being absorbed into it. Import cleanup removes exact extracted caption lines from the body; it does not strip ordinary references to figures. Both two-page PDFs were rendered and visually inspected, with matching fonts, abstract panel, figure order and reviewed captions. No `about:blank` or `CITE THIS ARTICLE` footer appeared. Previously published immutable releases require a reviewed republish; this deployment does not overwrite manually edited article fields.
- ClamAV accepted benign content and rejected the standard EICAR test. The worker recovered an expired processing lease and completed publishing. All generated release assets were readable.
- A synthetic listing benchmark with 400 portfolios and 80,201 article entries completed 40 requests at concurrency 4, p95 **854 ms**. This measures portfolio listing only, not 400 active users, bulk simultaneous extraction or representative stored PDF volume.
- Added configurable media quotas, upload concurrency limits and minimum free-disk headroom. Removed uploads still count toward quota because removal is recoverable.
- Installed the nightly local backup timer and verified archive checksums plus restoration into an isolated PostgreSQL container. Both the pre-activation backup, `/var/backups/brilliancy/20261024T075509Z`, and post-activation backup, `/var/backups/brilliancy/20261024T082423Z`, restored successfully and all **109 referenced media/release files** were present. Backups include owned studio routing. **Encrypted off-server storage is not configured.**
- HTTPS EasyPanel at `https://nxazkl.easypanel.host/` returned 200. Persistent IPv4/IPv6 rules restrict public direct access to port 3000 while preserving the internal proxy route and independent Hostinger console. MFA was explicitly deferred by the user.
- The authorized recovery request for the designated test account completed through the configured email provider. Inbox receipt remains unconfirmed; no password was changed.
- All **29 existing researchby sites returned HTTP 200** in bounded read-only checks before and after deployment. This verifies availability, not full content equivalence. Their routes remain on the old platform.

Earlier security deployment evidence:

- Created a consistent database, upload, certificate and configuration backup at `/var/backups/brilliancy/20261024T070153Z`; all four archive checksums passed.
- Restored the PostgreSQL dump with `--exit-on-error` into a temporary PostgreSQL 17 container with no network and no published ports. The restored portfolio/media counts matched the source (1 portfolio, 7 media records). Removed the temporary container afterward. This verifies this database dump, not a complete disaster recovery of files, routing, credentials and the legacy platform.
- Preserved the previous application image as `brilliancy:pre-security-20261024` for rollback. The database change is additive.
- Built and activated `brilliancy:416b98351004` on the existing demo studio after applying migration 011. Verified runtime Next.js 16.4.3, the `media.removed_at` column, healthy web/database/scanner containers, a running worker and an HTTPS 200 response from `/login`.
- Confirmed the signed-in portfolio editor loads revision 32 and exposes contextual document/image management and removal controls. No existing uploads were removed during live verification. Other hosted application containers remained running; no domain routing was changed.

## Outstanding launch gates

1. **Off-server backups and legacy restore.** Configure encrypted off-server storage, then prove restoration of the application and legacy systems, including uploads, credentials/configuration and exact router rules. The verified local new-platform backup does not protect against losing this VPS or certify legacy restore.
2. **Import and review all legacy content.** Obtain exports/original uploads, create each portfolio and assign the correct client. Compare biography, portrait/CV, article counts, authors/dates/abstracts, images/captions, downloads and old URL paths. Preserve manually edited content. Do not fabricate missing author/domain mappings or overwrite reviewed drafts.
3. **Representative capacity and storage plan.** The default media allowance remains 100 MB, now configurable through `PORTFOLIO_MEDIA_LIMIT_MB`. Measure representative originals, figures, releases and backup retention before choosing limits. Test realistic upload/publish/browse concurrency before promising 300–400 portfolios. The listing benchmark above does not certify this workload.
4. **Pilot one reviewed portfolio.** Record and back up its exact old router rules, connect/verify the domain, test HTTPS on root and `www`, `/login`, client isolation, links, inquiry form, mobile layout and PDFs. Switch only its explicit host routes. Watch errors and have a tested switch-back procedure before repeating for others.

Operational follow-up: confirm recovery email inbox delivery. MFA enrollment remains deferred at the user's request; it has not been silently enabled or made a prerequisite for the current testing.

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
