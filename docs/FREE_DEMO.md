# Free CEO demo — Brilliancy Research

This is the zero-cost presentation path. No OpenAI key, Hugging Face account, AWS account, paid domain, or GPU server is required. Render must accept your account and provision its Free plans. You still need an internet connection and an administrator computer with a compatible WebGPU GPU.

## What is included

| Capability                                        | Demo implementation                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| Admin/client accounts and field permissions       | Existing application; admin MFA remains required on HTTPS hosting     |
| Portfolio editing, typography, colours, preview   | Existing editor and all designs                                       |
| Publishing, revision history, rollback, inquiries | PostgreSQL queue and generated portfolio pages                        |
| CV extraction and article summaries               | Hugging Face Qwen2.5-1.5B-Instruct in the admin browser, using WebLLM |
| Files and published copies                        | PostgreSQL demo storage; survives app restarts                        |
| Invitations                                       | Copy the private invitation link; no email service required           |
| HTTPS and public demo address                     | Render's assigned `onrender.com` address                              |

Free AI is a smaller model, not a substitute for factual review. First use downloads roughly 1 GB of model files. Allow about 3 GB of available GPU memory; exact requirements vary. Use desktop Chrome or Edge with hardware acceleration enabled. The model runs in a web worker and is released after a task. Cached downloads may be reused; clearing browser storage removes them. Keep the tab open until processing finishes. Unsupported hardware produces an error rather than making a paid API call.

PDFs are uploaded to this application, where their text is extracted. The text is processed in the administrator's browser, and the proposal is saved back to this application. Hugging Face supplies model files; we do not send it CV or article text. The selected upstream model uses Apache 2.0: [Qwen model card](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct), [MLC browser conversion](https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC), [WebLLM](https://webllm.mlc.ai/docs/).

## Limits to explain before the presentation

- Render's Free web service sleeps after 15 minutes without incoming traffic and can take about a minute to wake. Its local filesystem is temporary; this app's demo files use PostgreSQL instead.
- Free Render PostgreSQL has a 1 GB capacity, expires after **30 days**, and has no managed backups. Put a day-21 backup/upgrade reminder in your calendar. Do not treat the later deletion grace period as usable hosting.
- The app limits demo files to **5 MB per upload**, **200 MB total**, including published copies and fonts. The existing per-portfolio allowance is still 100 MB. Repeated publications consume additional space.
- Use sample data only. Antivirus scanning and email delivery are absent. Demo uploads are administrator-only; clients can still edit their allowed fields. Domain provisioning, production CDN/WAF, availability guarantees and production recovery are outside this demo.
- AI accepts text-based PDFs: up to 20,000 extracted characters for a CV and 45,000 for an article. Longer documents are rejected without silently dropping text. Scanned PDFs require OCR first. Long documents take multiple inference passes.
- Free services have usage quotas. Keep plans Free, avoid adding billing details for this demo, and review the provider's displayed cost before creating anything. Account verification or availability restrictions can still prevent a free deployment.
- Demo responses include `noindex`; do not use this installation for real scholarship applicants or production SEO.

Source: [Render's current free-service limits](https://render.com/docs/free), checked 11 October 2026. This is a limited evaluation deployment, not indefinite free hosting.

## 1. Create your Render account

1. Open [Render signup](https://dashboard.render.com/register).
2. Choose GitHub and sign in as **taharukaiya**.
3. Verify your email if requested. Choose the free workspace option.
4. When installing/authorizing Render's GitHub integration, choose **Only select repositories**, then **Resume-Maker**. Keep the GitHub repository private.
5. Stop at the dashboard. Do not choose a paid compute plan or buy a domain.

## 2. Deploy the prepared Blueprint

1. Make sure the changes containing `render.yaml` have been pushed to `main`.
2. In Render, choose **New → Blueprint**.
3. Connect `taharukaiya/Resume-Maker`, choose `main`, and use the root `render.yaml`.
4. Name the Blueprint `brilliancy-ceo-demo`.
5. Check the proposed resources: `brilliancy-demo` (Free web service) and `brilliancy-demo-db` (Free PostgreSQL), both in Singapore. The quoted recurring resource charge should be **$0**. If Render requests a paid resource or the free database slot is already occupied, stop and resolve that before deployment.
6. Deploy. Render installs dependencies, builds the app, applies database migrations, and starts the server. No credentials are stored in Git.
7. Wait for the service to show **Live**. Open the exact URL shown on the web service page; the final hostname is assigned by Render and cannot be known before creation.

The Blueprint generates `SESSION_SECRET` and `SETUP_TOKEN` and connects `DATABASE_URL` automatically. `RENDER_EXTERNAL_URL` provides the app origin. Never copy the database URL, session secret, or setup token into chat. Automated Git deployments are disabled for predictable presentations; after future commits, use Render's **Manual Deploy → Deploy latest commit**.

If the provider's form rejects a Blueprint field, use [Render's Blueprint reference](https://render.com/docs/blueprint-spec) and report the exact non-secret error. Do not remove the Free plan selections to bypass a pricing restriction.

## 3. Create the administrator and enable MFA

1. In the Render web service's **Environment** section, privately reveal the generated `SETUP_TOKEN`.
2. In your browser address bar, append `/setup?token=` to your actual demo URL, then paste the generated token immediately after the equals sign. Open that private link. The form requires the token in the URL; do not share the bootstrap link.
3. Enter your name, agency email, agency name, and a unique password of at least 12 characters.
4. Sign in at `/login`.
5. Open **Account security / Settings**, set up an authenticator app, and verify a current six-digit code. Save its recovery/setup material privately. Hosted administrator actions require MFA even in the demo.
6. In Render, retain `SESSION_SECRET` securely; changing it breaks enrolled MFA seed decryption. After successful bootstrap, remove `SETUP_TOKEN` from the web service environment if desired; the first-admin endpoint also refuses to run once accounts exist.

Use **People & access** to invite another administrator or client. Share the returned one-time invitation link privately yourself. The application does not send mail until SES is connected. A second administrator also needs MFA.

## 4. Check the actual deployment

Use your real URL, copied from Render:

```powershell
$demoUrl = (Read-Host 'Paste the Render HTTPS URL').TrimEnd('/')
Invoke-RestMethod "$demoUrl/api/status"
Start-Process "$demoUrl/login"
Start-Process "$demoUrl/studio/settings"
```

`/api/status` should return JSON including `initialized`. Settings should show the browser AI provider and PostgreSQL. These indicators detect configuration; they do not prove model accuracy or hardware compatibility.

1. Create a portfolio with sample content; choose a design, fonts and colours.
2. Upload a short text-based sample CV in **Fill from CV**; click **Extract details**. Allow the first model download to finish.
3. Open **Review extracted details**, compare dates/names/qualifications with the PDF, select fields, apply them, and save the draft.
4. In the media tab, enable **Generate a free summary after each article upload**, then upload a short sample research PDF. Alternatively, click **Generate summary** for an existing article.
5. Verify the summary against its paper before adding it to a publication. A generated summary must not be represented as the author's original abstract.
6. Configure a client's editable fields; accept their invitation in a separate browser profile. Check that unauthorized fields and admin actions remain inaccessible.
7. Preview on desktop and mobile, then publish. Open the public link shown by the app. Test an inquiry and verify it reaches the admin inbox.
8. Make a visible change, publish again, test rollback, and test unpublish. Re-publish the chosen version for the presentation.
9. Restart the Render service and confirm the draft, uploaded file and published portfolio still exist.

For the meeting, open the app shortly beforehand and complete one AI run on the **same computer and browser profile** you will present from. Do not leave the first model download or hardware check until the CEO is waiting. The public portfolio itself never downloads the AI model.

## 5. If something fails

| Symptom                                   | Action                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Render loading screen                     | Allow the free service to wake; inspect Events/Logs if it remains unavailable                                                     |
| Build failed                              | Read the first actual error in the build log; share it without secrets                                                            |
| Login works but admin changes are blocked | Enable and verify MFA in Account security                                                                                         |
| Missing/invalid origin                    | Remove an old localhost `APP_URL` in Render; use its automatic external URL or your exact HTTPS service URL                       |
| AI reports unsupported GPU                | Enable Chrome/Edge hardware acceleration and restart; use another computer if no compatible adapter is exposed                    |
| AI download fails                         | Check network access to Hugging Face and WebLLM model libraries, free disk space, browser cache and extensions                    |
| Extraction is incomplete/invalid          | Use a clearer, shorter text PDF and review manually; the app does not save malformed partial results                              |
| Scanned PDF                               | OCR it first or use the later paid PDF processing path                                                                            |
| Upload denied for a client                | Intentional demo restriction; admin uploads sample files while the scanner is absent                                              |
| Free DB expired                           | Restore a backup to a new supported database or upgrade through Render; there is no app-side way to restore provider-deleted data |

## 6. Preserve the demo before day 30

For a small presentation, export every portfolio from the editor and download its original media. The content JSON is **not** a complete database backup. Store these files outside Git.

For a complete backup, install PostgreSQL client tools at the same or a newer major version than the hosted database. Render initially blocks external database connections. In the database access settings, temporarily allow only your current public IP with `/32`. Use the external host/port/database/user from Render and let `pg_dump` prompt for the password:

```powershell
New-Item -ItemType Directory -Force .data/backups | Out-Null
$env:PGHOST = Read-Host 'External PostgreSQL host from Render'
$env:PGPORT = Read-Host 'External PostgreSQL port from Render'
$env:PGDATABASE = Read-Host 'Database name from Render'
$env:PGUSER = Read-Host 'Database username from Render'
$env:PGSSLMODE = 'require'
pg_dump -W --format=custom --no-owner --no-acl --file=.data/backups/brilliancy-demo.dump
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; do not remove the original database.' }
pg_restore --list .data/backups/brilliancy-demo.dump
```

Remove that external IP permission immediately after the backup. Keep the dump and the existing session encryption secret in encrypted agency storage, separate from Git. A successful `pg_restore --list` is only a format check; test an actual restore into an empty isolated database and run the app against it before relying on the backup.

After CEO approval, follow [COSTS_AND_LAUNCH.md](COSTS_AND_LAUNCH.md) and [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md). Moving demo data to AWS needs a deliberate database/file migration: copy `demo_objects` into the correct S3 buckets, preserve keys, rewrite/re-publish URLs, and verify content before disabling demo mode. Simply changing the flag does not migrate files.

## Local free-AI development

Set only `AI_PROVIDER=huggingface-browser` in the local `.env`; leave `DEPLOYMENT_MODE` blank to continue using the existing local data and file storage. Restart the development server. Do not turn demo mode on against a populated local file workspace, because it intentionally selects a different storage backend.

```powershell
npm.cmd ci
npm.cmd run ai:browser
npm.cmd run dev
```

Open [local login](http://localhost:3000/login). Manual editing remains available if your browser cannot run the model.

## Checking navigation speed

The workspace preloads its main navigation routes in production and prepares
portfolio editor routes on hover, keyboard focus, or touch. Page data is fetched
through the authenticated API on every visit. Loading feedback keeps the sidebar
usable while a request is pending, and independent editor requests run together.

`npm run dev` compiles pages on demand and does not enable Next.js automatic
production prefetching. A first local visit can therefore take several seconds.
Judge the deployed build after the service has woken up; Render already runs
`npm run build` and `npm run start` using the Blueprint. A local production start
requires the PostgreSQL and HTTPS configuration documented in the deployment
guide; do not switch off production validation to benchmark the embedded database.

After pushing an update, open **Render → brilliancy-demo → Manual Deploy → Deploy
latest commit** (automatic deploys are disabled in this Blueprint). Wait for the
deployment to become live, refresh the browser once, then click through Overview,
Portfolios, People & access, Inbox, Activity log, and Settings & security. Confirm
the active link changes, pages populate, and keyboard/mobile navigation works.
The regression check is `npm.cmd run test:e2e -- tests/browser/navigation.spec.ts`.

A free Render service sleeps after 15 minutes without incoming traffic and can
take about a minute to wake. Route optimizations cannot remove that hosting delay;
open the demo before presenting. See [Render's free-service limits](https://render.com/docs/free).
