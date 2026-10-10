# Completion checklist and manual setup

This is a working local application with production infrastructure definitions. It is not yet a verified live service. Track launch readiness separately from whether the source compiles.

## Current local blocker

The audit on 10 October 2026 found the application reachable at `http://localhost:3000`, but `/api/status` reported `initialized: false`. No administrator had been created. Logging in cannot work until this is done. No real user or portfolio data is seeded automatically.

1. Open PowerShell in the project folder.
2. Run `npm.cmd run setup`. Keep the printed token/link private.
3. If the app is not running, run `npm.cmd run dev` in a separate terminal and leave it open. Use only one local development server against `.data`.
4. Open the complete setup link printed in step 2. Enter your name, agency email, and a unique password of at least 12 characters.
5. After the success message, visit `http://localhost:3000/login` and sign in.
6. Run `npm.cmd run doctor` in another terminal. The administrator check should now pass.
7. Open Settings & security and enroll your authenticator. Store its manual setup key securely.

If setup says it is already complete, sign in instead. The installation token cannot reset an existing administrator. Do not delete `.data` to fix an account problem: that directory contains the real local database and uploaded files.

The existing local browser log also contains a hydration warning caused by Grammarly adding `data-gr-ext-installed` attributes to the page. If you see that warning, try an incognito browser window with extensions disabled. Do not treat this specific extension warning as proof that the database or login is broken; report any remaining application error separately.

## Functional acceptance checklist

Use your own content for this walkthrough. Browser tests use separate fixture accounts and storage.

| Area                                            | Implementation and verification                                    | What you should check                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Administrator setup and login                   | Implemented; browser and database tests                            | Create your real administrator and enable MFA                                                              |
| Client invitations                              | Implemented; browser-tested acceptance and sign-in                 | Invite a real client; copy the private invitation link until email is connected                            |
| Per-client permissions                          | Server enforcement and browser tests                               | Assign the client under portfolio Permissions; allow only intended fields                                  |
| Profile, biography, dates and academic sections | Implemented; schema and editing tests                              | Add an About section to display the biography; add education and publications with real dates              |
| Images and PDF uploads                          | Implemented; signature, optimization, ownership and browser checks | Upload portrait/CV, then select them in Profile; upload articles separately                                |
| Custom pages and draft preview                  | Implemented; private page navigation and image rendering checked   | Preview every page before publication                                                                      |
| Themes, wording and SEO                         | Implemented structured controls                                    | Choose design, edit SEO & labels, check mobile layout and actual content                                   |
| Client review and publishing                    | Implemented; client submission and publication workflows checked   | Review proposed changes, publish, and open the public link                                                 |
| History, restore, rollback and unpublish        | Implemented; database workflow tests                               | Try these on a non-client portfolio before launch                                                          |
| Public contact form and inbox                   | Implemented; browser and database checks                           | Send an inquiry and verify it appears in Inbox                                                             |
| AI summaries                                    | Real integration implemented; enqueue path tested                  | Requires API key, selected model, billing, and representative-paper evaluation                             |
| Email delivery and password recovery            | SES integration implemented                                        | Requires verified domain, SES production access, and successful delivery tests                             |
| Custom domains                                  | Ownership checks and provisioner implemented                       | Requires DNS, AWS/ACM/CloudFront deployment and live HTTPS checks                                          |
| Availability and recovery                       | AWS infrastructure and runbook provided                            | Requires real deployment, container validation, restore drill, load test, alert routing and incident owner |

Configuration shown in Settings means values are present. It does not prove the provider accepted a request. Automated local tests do not prove production security, uptime, SEO ranking, or AI factual accuracy.

Verification for this audit: 34 automated tests passed, both Chrome browser workflows passed, TypeScript passed, and the production build completed. The diagnostic correctly reported incomplete administrator setup and absent external-service configuration. The browser runner required execution outside the Windows sandbox to complete process cleanup; ordinary local terminal usage does not use that sandbox.

## Changes made during this audit

- Browser tests now use a separate Next.js output directory and explicitly clear cloud-service environment variables so they can run alongside the local app without using real external services.
- First-time setup explains missing tokens and completed setup, and surfaces status/database failures instead of silently ignoring them.
- Added `npm run doctor` for read-only local readiness checks. It never opens the embedded database in a competing process or prints secrets.
- Draft preview links now stay in authenticated draft pages, including publication detail pages; missing draft routes return 404.
- Draft entry images use media MIME metadata, so extensionless private asset URLs render correctly.
- Saved researcher names now update the dashboard and inbox portfolio name.
- Server validation rejects non-image portrait/social files and non-PDF CVs.
- Contact form minimum message length now matches server validation.
- Service indicators say configured instead of claiming a verified connection.
- Expanded integration and browser coverage for these workflows.

## Manual account work, in order

### 1. Confirm the existing domain

Send the exact agency domain and DNS provider name, without credentials. Choose the studio subdomain. Preserve all current website and email DNS records. You do not need to buy another domain or shared hosting.

### 2. Create the agency AWS account

Follow [GETTING_STARTED.md](GETTING_STARTED.md), section 2: agency-owned billing and recovery details, root MFA, IAM Identity Center developer access and budget alerts. The application does not need root access keys. Choose the billing thresholds with the agency owner.

### 3. Install deployment prerequisites and authenticate

Install Docker Desktop, AWS CLI v2, and PowerShell 7. Start Docker, then use the agency's SSO configuration:

```powershell
aws configure sso
aws sso login
aws sts get-caller-identity
docker version
```

The returned AWS account must be the intended agency account. Do not paste access tokens or passwords into chat.

### 4. Configure DNS and deploy

Use [DEPLOYMENT.md](DEPLOYMENT.md) for the actual studio hostname, Route 53 zone ID/name, CDK bootstrap, synthesis review, and `infra/deploy.ps1`. Deployment creates paid resources; complete the account/domain details and review the proposed resources first. A successful local build does not substitute for this step.

After deployment, create a separate production administrator using the setup secret in AWS Secrets Manager and enable MFA. Local accounts and uploads do not automatically migrate to AWS.

### 5. Connect email

Verify the SES identity and DNS records, request SES production access, and test invitations and password recovery with a real mailbox. Until then, admins can copy invitation/access links privately from People & access. Public contact messages still appear in the app Inbox; they are not automatically forwarded by email.

### 6. Connect AI

Create an agency OpenAI API project with API billing, a server-side key, and an explicitly selected compatible model. Follow the account guide to store `apiKey` and `model` in AWS Secrets Manager. For local evaluation, set `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env` and restart the server. Never commit the key.

Upload a real PDF with the research article purpose. Check that its summary job finishes, compare the summary against the paper, and add the reviewed result to a publication draft. Test scanned papers and papers containing quantitative results. CV uploads should not automatically generate article summaries. These real calls incur API charges.

### 7. Validate the live installation

Complete [OPERATIONS.md](OPERATIONS.md): HTTPS on each hostname; actual email/AI/scanner requests; database and media recovery; real-world load/performance checks; monitoring delivered to a responsible person; browser acceptance with separate admin and client identities. Test the container on AWS before accepting client data. No availability guarantee is claimed until the operating target and evidence are agreed.

## Repeatable verification commands

```powershell
npm.cmd run doctor
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e -- --reporter=html
npx.cmd playwright show-report
npm.cmd audit
```

The browser server uses port 3100 and `.test-data/browser`; normal development uses port 3000 and `.data`. Both can now run at once. A browser test must not be started while another browser-test run is still active.

Stop the normal development server with Ctrl+C before the production build, then restart it afterward:

```powershell
npm.cmd run build
npm.cmd run dev
```

`npm run start` and a separate `npm run worker` are for a properly configured production/PostgreSQL installation, not the default embedded local setup. Test reports are local; GitHub Actions results are under the repository's Actions tab.
