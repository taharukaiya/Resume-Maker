# Architecture and engineering decisions

## One application, clear boundaries

The platform uses Next.js, React, TypeScript, Zod, PostgreSQL, and explicit SQL repositories/services. The agency’s constrained client permissions and approval workflow are implemented directly in the application. It does not depend on an additional CMS or page-builder service.

The initial discussion considered Astro and Payload. For a solo maintainer, this implementation uses one framework with a custom typed editor and a separate pure HTML renderer. The public output contains no React hydration bundle. The application remains a modular monolith with an independently runnable worker.

## Content and permissions

`PortfolioDocument` is the shared, strict content schema. It includes profile fields, sections, entries, pages, theme settings, SEO metadata, navigation wording, and public labels. Display dates support year, month, or day precision. System audit times cannot be edited.

Each site has one assigned client. `editable_fields` is an allowlist. Client writes are checked against the previous database document after schema validation; changing a hidden field fails the whole request. Existing permitted sections may be edited; clients cannot change their identity, type, count, or order. Additional pages and publishing remain admin-only.

Every protected site and media route checks the authenticated user’s site ownership. Invitation and reset tokens are random, single-use, expiring, and stored as hashes. Sessions are opaque tokens in HttpOnly SameSite cookies; the database stores hashes. Passwords use scrypt. TOTP seeds are encrypted with AES-GCM using the session encryption secret. Production administrator operations require MFA.

## Persistence

The isolated CEO demo uses `DEPLOYMENT_MODE=demo`, a free hosted PostgreSQL database, and a bounded `demo_objects` bytea store (200 MB total, including release copies). This avoids losing uploads when Render sleeps. It is not the production storage architecture. The free database expires after 30 days; preserve it before expiration. Production assertions still require PostgreSQL, HTTPS and strong session secrets; MFA and tenant authorization remain enforced. Demo uploads are limited to administrators and 5 MB sample files. Client uploads require the production scanner path.

Production uses PostgreSQL with SQL migrations and migration checksums. The deployment uses a dedicated migration role and a restricted runtime role. Runtime cannot change schema or edit/delete existing audit events. Local PGlite runs the same PostgreSQL schema, with a single application process.

Site updates lock the row and compare an integer revision before writing. Client submissions are marked for review. A publish request captures the exact approved document and revision in the durable job payload. Later edits cannot change that queued snapshot.

## Publishing and delivery

The worker copies referenced, approved files into an immutable release prefix and generates HTML, publication pages, sitemap, and robots files. The public route reads an activated storage manifest and release files; it does not query PostgreSQL. Failed builds leave the current manifest intact.

Custom domains are served directly from S3 through CloudFront using Origin Access Control, TLS, a path-rewrite function, a security-header policy, and a global WAF ACL. New releases update their CloudFront origin path and invalidate caches. Distribution propagation is asynchronous, so different visitors may briefly see the previous approved release during rollout. Release assets use immutable URLs and do not mix with new-release assets.

CloudFront control-plane updates and PostgreSQL commits are not one atomic transaction. Operations are designed to be repeatable; monitor failed publication jobs and use release rollback after partial provider failures. CDN propagation and DNS outages remain external dependencies.

Private source uploads and published release files are in separate S3 buckets. The public-asset distribution’s path guard serves only release assets, never private source documents or generated HTML. Public HTML uses the portfolio’s own distribution.

## Background jobs

The PostgreSQL queue uses `FOR UPDATE SKIP LOCKED`, per-site publishing uniqueness, expiring worker leases, heartbeat renewal, bounded retries, and stored error states. Only the worker with the current lease can activate a release. A separate queue service is unnecessary for the initial scale; the module boundary allows migration to SQS if measured throughput warrants it.

Database-backed rate limits protect authentication and expensive AI operations across replicas. WAF rate limiting supplements application limits.

## Article processing

`AI_PROVIDER=huggingface-browser` selects a lazy-loaded WebGPU worker running Qwen2.5-1.5B-Instruct (MLC quantization) downloaded from Hugging Face. PDF text is extracted by the authenticated server, processed in the admin browser, and returned to an admin-only proposal endpoint. The server validates the actual portfolio schema before storage; browser output is treated as administrator-submitted data, not verified model provenance. Text is chunked without truncation, CV conflicts are flagged, and article summaries are reduced in bounded groups. Browser tasks need an open tab; they are separate from the server queue and never fall back to a paid API. Scanned PDFs need OCR outside this free path. No AI runtime is included in generated public portfolios.

With `AI_PROVIDER=openai` (the existing default), the following server processing path applies.

PDF uploads are file-signature validated and scanned. Text extraction is attempted first. Scanned/unsupported extraction results use the selected model’s native PDF input. The document is treated as source data, never instructions. The API returns a structured summary, keywords, and limitations with model and generation time recorded.

AI output is not automatically published or presented as the original author abstract. An administrator explicitly adds it to a publication draft and reviews it. Actual factual quality must be evaluated using representative papers in the agency’s research fields.

## Deliberate boundaries

- No self-service registration; agency administrators invite accounts.
- No arbitrary HTML, scripts, fonts, or executable template uploads.
- No public listing of unfinished clients or private media.
- Content JSON export contains document data and media metadata; download original files separately. It is not a complete database backup.
- Region failover, application monitoring alerts, recovery objectives, and third-party security assessment need deployment-specific verification.
- Model and email integrations show configuration state; live delivery is established only by real requests.
