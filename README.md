# Brilliancy Research — Portfolio Studio

A multi-tenant platform for creating, reviewing, and publishing academic portfolios. Administrators manage researchers and publishing from one studio; clients edit the fields their administrator allows. Public portfolios are generated from approved snapshots, so editing a draft does not change the live website.

The repository is named **Resume-Maker**; the application is **Brilliancy Research Portfolio Studio**.

## Features

- **Portfolio editor:** profile, portrait, CV, biography, academic history, research, articles, custom pages, social and academic links, quotes, and cards.
- **Consistent presentation:** responsive portfolio design, editable navigation and labels, configurable icons, subtle motion, and accessible mobile navigation.
- **Article imports:** upload PDF, DOCX, or DOC documents; extract readable text and embedded images; review proposed metadata and abstracts before publishing.
- **Caption extraction:** match labelled captions to nearby figures in PDFs and converted Word documents. Captions remain editable and stay attached when images are reordered. Uncertain matches are left blank for review.
- **Article editing:** rich text controls for headings, bold, italic, lists, and text color; separate fields for authors, date, abstract, reading time, cover image, and figure captions.
- **PDF downloads:** generate article PDFs from reviewed content, with embedded fonts, a styled abstract, headings, paragraphs, images, and captions. Downloads omit the website citation widget and browser-generated `about:blank` footer.
- **Publishing:** save drafts, preview, publish an approved version, restore editing history, roll back to a previous release, or take a portfolio offline.
- **Website addresses:** suggested personal domain names, editable domains, DNS instructions, ownership verification, and routing integrations for HTTPS and canonical `www` addresses.
- **Administration:** invitations, client permissions, inquiry inbox, audit history, account recovery, and authenticator-app MFA.
- **Upload removal:** administrators can remove unused documents and images beside the upload controls, and restore them later. Saved draft references are protected; published assets and history are preserved. Removed uploads remain stored and count toward the media allowance.

## Technology

| Layer                 | Implementation                                           |
| --------------------- | -------------------------------------------------------- |
| Application           | Next.js 16, React 19, TypeScript                         |
| Content validation    | Zod                                                      |
| Article editor        | Tiptap                                                   |
| Database              | PostgreSQL in production; PGlite for local development   |
| Documents and images  | PDF.js, pdf-parse, PDFKit, Sharp, LibreOffice Writer     |
| Storage               | Persistent VPS disk or AWS S3                            |
| Background processing | Durable jobs with a separate production worker           |
| Deployment            | Docker Compose on a VPS; optional AWS CDK infrastructure |

## Local development

### Requirements

- Node.js **24** is recommended and is used by the Docker image. The package declares Node.js 22 or newer.
- npm, included with Node.js.
- Git and access to this repository.
- LibreOffice Writer if you want to test Word uploads locally. The production Docker image includes it.

### Install and start

```bash
git clone https://github.com/taharukaiya/Resume-Maker.git
cd Resume-Maker
npm ci
npm run setup
npm run dev
```

`npm run setup` creates a local `.env` if needed, fills missing session and setup secrets, and prints a private, one-time setup link. Start the development server, then open that link to create the first administrator. The default application address is `http://localhost:3000`.

No administrator credentials or researcher portfolios are seeded. Keep the setup link private; it stops working after the first administrator is created.

Local development stores its embedded database and files under `.data/`. Run only one application process against a given embedded database directory. With `RUN_WORKER=true`, the development application also processes background jobs.

Run the readiness check while the application is running:

```bash
npm run doctor
```

### Configuration

[.env.example](.env.example) documents available configuration names and safe defaults. Use `npm run setup` for local configuration; use the VPS configuration workflow for production.

| Configuration                                    | Purpose                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `APP_URL`                                        | Studio origin, such as `http://localhost:3000` locally                     |
| `SESSION_SECRET`, `SETUP_TOKEN`                  | Session security and first-administrator bootstrap                         |
| `DATA_DIR`                                       | Local or VPS data directory                                                |
| `DATABASE_URL`                                   | PostgreSQL connection; leave blank for local embedded development          |
| `RUN_WORKER`                                     | Enable the in-process development worker                                   |
| `DEPLOYMENT_MODE`                                | `vps` for persistent VPS storage; blank for AWS; `demo` for isolated demos |
| `PUBLIC_ASSET_URL`                               | Separate public media origin required for production                       |
| `AI_PROVIDER`                                    | Explicit extraction provider: `gemini`, `openai`, or `huggingface-browser` |
| `GEMINI_API_KEY`, `GEMINI_MODEL`                 | Server-side Gemini configuration                                           |
| `OPENAI_API_KEY`, `OPENAI_MODEL`                 | Server-side OpenAI configuration                                           |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` | Transactional email configuration; SES is also supported                   |
| `CLAMAV_HOST`, `CLAMAV_PORT`                     | Private production malware-scanning service                                |
| `LIBREOFFICE_BIN`                                | Optional path to the local LibreOffice executable                          |
| `VPS_PUBLIC_IP`                                  | Public address shown in admin DNS instructions                             |
| `RELEASE_RETENTION`                              | Published releases retained per portfolio; `0` keeps all                   |

AWS deployments additionally configure the database, S3 buckets, public asset origin, and AWS credentials through the deployment environment. See the infrastructure and deployment files for the selected topology.

Do not commit real environment files, API keys, credentials, databases, uploads, backups, or generated infrastructure outputs. Provider-backed extraction sends documents to the configured provider; review its terms and quotas before using private documents. Text, image, and labelled-caption extraction can run without an AI key. Metadata or abstract generation depends on the selected provider.

## Create and publish a portfolio

1. Sign in to the studio and create a portfolio.
2. Add the person's profile, academic sections, links, and pages.
3. Under **Research** or **Articles**, upload a document or create an entry manually.
4. Check the extracted title, authors, date, abstract, body, images, and captions. Correct anything that needs attention.
5. Save the draft and use **Preview** to review the website.
6. Use **Review & publish** to publish the approved draft.
7. Configure the personal domain under **Website address** when ready.

Client access is account-based and restricted by the portfolio's permissions. Connecting a domain does not grant access to the studio. A connected portfolio's `/login` route redirects to the central studio login.

### Article import behavior and limits

- Uploads accept PDF, DOCX, and DOC files up to **20 MB** each; demo uploads have a smaller limit.
- Word files are scanned, converted to PDF in an isolated LibreOffice profile, and scanned again. The converted PDF is retained as the uploaded source.
- Automatic extraction covers the first **40 pages**, up to **24 images / 16 MB** of extracted images, and up to **240,000 characters** of display text.
- Extracted images are optimized to WebP at up to 1800 pixels. Small graphics, vector figures, large images, and scanned text may require manual correction or direct image upload.
- Labelled captions are matched using image and text positions on the same page. Ambiguous, unreadable, or unsupported captions require manual entry.
- Portfolios currently have a **100 MB media allowance**, including extracted figures. Published releases, database storage, and backups require additional capacity.
- AI proposes an abstract when one is missing. All extracted or generated information needs review; importing a document does not publish it.
- The uploaded source and the generated article download are different: the article download is typeset from the saved, reviewed article content. Content outside extraction limits must be added manually if it should appear in that download.

## Commands and verification

| Command              | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Start the development server                         |
| `npm run setup`      | Prepare local configuration and print the setup link |
| `npm run doctor`     | Check application readiness                          |
| `npm run db:migrate` | Apply database migrations                            |
| `npm run worker`     | Run the background worker separately                 |
| `npm run typecheck`  | Check TypeScript                                     |
| `npm test`           | Run Vitest tests                                     |
| `npm run test:e2e`   | Run Playwright browser tests                         |
| `npm run build`      | Create a production build                            |
| `npm run check`      | Run type checking, tests, and a production build     |
| `npm start`          | Start a standard Next.js production build            |

Local browser tests use installed Google Chrome, port **3100**, and an isolated database under `.test-data/`. CI uses Playwright Chromium. Tests do not use the normal `.data/` workspace.

A successful build verifies the application code. Production acceptance also includes uploads, document conversion, worker processing, email, DNS/HTTPS, and a backup restoration check in the deployed environment.

## Production deployment

Read the [production readiness and researchby migration review](docs/PRODUCTION_READINESS.md) before replacing an existing portfolio. Passing local tests does not approve a bulk domain cutover.

The application provides its own admin panel. **cPanel is not required.** A central studio serves administrators and clients, while each published portfolio can use its own domain.

Choose the guide that matches the server:

- [EasyPanel VPS deployment](docs/HOSTINGER_EASYPANEL.md) — integrate with an existing EasyPanel proxy.
- [Existing VPS deployment](docs/HOSTINGER_EXISTING_VPS.md) — integrate with an existing host proxy.
- [New VPS deployment](docs/HOSTINGER_VPS_LAUNCH.md) — install on an empty server with the supplied HTTPS proxy.
- [Email and AI services](docs/FREE_SERVICES_SETUP.md) — provider configuration and service limits.

Production runs PostgreSQL, web, worker, and ClamAV services. VPS mode requires persistent storage and a separate media origin. Compose files and the configuration helper are in [deploy/vps](deploy/vps/). The helper generates `deploy/vps/.env`; it refuses to overwrite an existing configuration.

For an existing installation, retain its environment and secrets, select the existing Compose topology, apply any required migrations, and deploy a tested image. Do not replace a live server's proxy or rerun initial setup as an upgrade procedure.

The admin panel supplies DNS records and ownership checks; domain registration is separate. Automatic HTTPS and root-to-`www` redirects also require correct DNS and the deployed proxy/domain reconciler. AWS deployments use the separate provisioning workflow under `infra/` and `scripts/`.

### Backups and operations

Back up the database, persistent uploads and releases, configuration, and certificate data. The VPS [backup script](deploy/vps/backup.sh) briefly stops application services to create a consistent backup. Store backups off-server and test restoration.

Monitor disk usage, job failures, scanner health, email delivery, and provider quotas. Configure release retention for the expected workload; retained releases can take considerably more space than the original uploads. Historical deployment guides describe specific server snapshots, so confirm current capacity and configuration before following them.

## Repository layout

```text
src/
  app/                    Next.js routes, API endpoints, and layouts
  components/             Studio dashboard, forms, and portfolio editor
  lib/                    Configuration, database, storage, email, and crypto
  modules/
    api/                  Request validation and dispatch
    auth/                 Sessions, permissions, rate limits, and audit
    portfolios/           Content schema and editing workflows
    media/                Uploads, document conversion, text/images/captions
    publishing/           Public HTML, article PDFs, releases, and domains
    jobs/                 Background processing
migrations/               Versioned database migrations
scripts/                  Setup, diagnostics, workers, and domain tooling
deploy/vps/               Docker Compose, proxy, build, and backup tooling
infra/                    Optional AWS CDK infrastructure
public/                   Public static assets and fonts
tests/                    Unit, integration, fixture, and browser tests
docs/                     Feature and deployment notes
```

## Troubleshooting

| Problem                        | What to check                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| First login is unavailable     | Run local setup, start the server, and use its private setup link. Existing installations use `/login`.                         |
| Word upload fails              | Confirm LibreOffice is installed and `LIBREOFFICE_BIN` is correct. In production, confirm the current Docker image is deployed. |
| Article details remain pending | Check worker availability, job status, and the selected AI provider's configuration and quota.                                  |
| A caption is missing           | Check that the document has a readable labelled caption near the figure; enter or correct it in the image's caption field.      |
| Draft changes are not public   | Save, preview, and publish the approved draft.                                                                                  |
| Domain or HTTPS is pending     | Check the admin DNS instructions, ownership verification, DNS propagation, and proxy/domain reconciler status.                  |
| Production startup fails       | Check required configuration, PostgreSQL, persistent storage, separate media origin, and scanner availability.                  |

See [portfolio page notes](docs/PORTFOLIO_PAGES.md), [article notes](docs/ARTICLES.md), and the [deployment audit](docs/PRE_DEPLOYMENT_AUDIT.md) for additional context. These notes may describe earlier stages; the current source and deployment configuration determine runtime behavior.
