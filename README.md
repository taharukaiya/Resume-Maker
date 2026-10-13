# Brilliancy Research — Portfolio Studio

A multi-tenant academic portfolio application for a scholarship agency. Administrators own publishing and configure which fields each client can edit. The public website is generated from an approved snapshot into immutable HTML and assets.

## Start locally

For the CEO presentation, follow [the free demo deployment guide](docs/FREE_DEMO.md). If browser AI cannot download or process a model on your computer, follow [AI setup](docs/AI_SETUP.md) for the Gemini free-tier server option or paid OpenAI processing. Read [costs and production requirements](docs/COSTS_AND_LAUNCH.md) before upgrading. The free hosted database expires after 30 days.

Start with the [completion checklist](docs/COMPLETION_CHECKLIST.md) for current blockers, manual account setup, and the acceptance walkthrough. Run `npm run doctor` while the app is running to diagnose local readiness.

Install Node.js 24 LTS, then run from this directory:

```powershell
npm ci
npm run setup
npm run dev
```

Open the private `/setup?token=...` link printed by `setup`. Create your own first administrator. No accounts, portfolios, credentials, or example research are seeded into the real workspace. Local data persists under `.data/` and is excluded from Git.

Local development uses embedded PostgreSQL (PGlite), local storage, and an in-process durable job worker. Do not start two application processes against the same embedded database. Production uses PostgreSQL, private S3 storage, a separate public-artifact bucket, and separate web/worker containers.

## Implemented workflows

- First-admin bootstrap with a one-time installation secret; secure password sessions; invitations and password recovery; authenticator-app MFA.
- Agency accounts and per-portfolio client assignment. Permission enforcement happens on the server.
- Profile, biography, links, CV, portrait, academic sections, entries, dates, custom pages, section ordering, six curated designs, automatic search metadata with optional overrides, and editable website labels.
- Versioned drafts, optimistic concurrency, client submissions, administrator review, preview, publication jobs, historical draft restore, release rollback, and unpublishing.
- Tenant-isolated media library, file signature validation, bounded uploads, optimized images, and production ClamAV scanning.
- Reviewed CV extraction and article summaries through explicit provider selection: Hugging Face in the browser (WebGPU required), Gemini on the server (free project quotas or paid), or paid OpenAI. Server processing uses background jobs and supports native PDF input.
- Direct profile-photo upload with an optimized preview and automatic draft selection.
- Eight portfolio compositions, coordinated design presets, adjustable CSS motion, sticky navigation, a section index, and expandable research descriptions without a public JavaScript bundle.
- Contextual browser tab titles and accessible in-app confirmations for editing and destructive actions.
- Generated HTML, individual publication pages, structured data, canonical URLs, sitemap, robots directives, responsive layouts, and contact forms.
- Inquiry inbox, audit history, content JSON export, custom-domain ownership verification, and AWS CloudFront provisioning script.

## Project structure

```text
src/
  app/                    Next.js routes and layouts
  components/             Dashboard and editor UI
  lib/                    Database, storage, crypto, config, email
  modules/
    api/                  HTTP request validation and dispatch
    auth/                 Sessions, permissions, audit, rate limits
    portfolios/           Content schema and editing rules
    media/                Upload validation and malware scanning
    publishing/           HTML renderer, releases, CDN operations
    jobs/                 Durable background processing
migrations/               Versioned SQL migrations with checksums
scripts/                  Setup, migrations, worker, domain provisioning
infra/                    AWS CDK infrastructure and deployment workflow
tests/                    Domain, integration, infrastructure, browser tests
docs/                     Architecture, accounts, deployment, operations
```

## Verification

```powershell
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit
```

Browser tests use the installed Chrome on a local Windows machine, an isolated database under `.test-data/browser`, and port 3100. CI installs Playwright Chromium. Test-only people and portfolios never enter `.data`.

## Production

Follow the [complete first-deployment walkthrough](docs/LAUNCH_GUIDE.md) for tool installation, AWS sign-in, DNS, AI secrets, deployment commands and verification.

Start with [the account guide](docs/GETTING_STARTED.md), then [deployment](docs/DEPLOYMENT.md). Read [architecture](docs/ARCHITECTURE.md) and [operations](docs/OPERATIONS.md) before accepting live client data. Run the application’s `/guide` page for the concise onboarding walkthrough.

The repository includes production integrations and deployment definitions. Live AWS provisioning, real email delivery, AI output evaluation, custom-domain HTTPS, and disaster recovery must be verified in the agency’s accounts before launch. A local build or synthesized infrastructure template does not establish production availability.
