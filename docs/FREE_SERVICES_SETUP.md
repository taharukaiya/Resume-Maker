# Free services setup

The Settings screen now contains agency identity, two-factor authentication and password controls. Hosting diagnostics belong in this guide and operator tools, not client-facing setup panels. Removing those panels does not configure missing services or suppress operational errors.

## What is free

- Docker Engine, Caddy HTTPS, PostgreSQL, ClamAV and local media storage software have no licence charge. They run on the existing paid Hostinger VPS.
- Gemini is the default AI provider for new configurations, using `gemini-3.5-flash-lite` with an eligible Free-tier project and a private API key. Google's current pricing lists free input and output for this model, subject to Free-tier quotas. Keep the project on the Free tier; the application does not control Google billing. [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Browser AI remains an opt-in alternative through the existing Hugging Face integration, with no API key, subscription or paid fallback. It uses the administrator's computer, not visitors' devices.
- Resend Free handles invitations and password resets. Its published allowance is 3,000 transactional emails/month, capped at 100/day. Stay on the Free plan; monitor usage. Exhausting the allowance can interrupt delivery. Sending 400 invitations requires spreading them over several days, leaving room for resets.
- Hostinger hosting, domain registrations/renewals and sufficient independent backup storage are separate. This guide does not make those free or claim a free backup account can hold 400 portfolios.

Sources checked 13 October 2026: [Resend pricing](https://resend.com/pricing), [sender-domain verification](https://resend.com/docs/dashboard/domains/introduction).

## 1. Set up free email

1. Create an agency-owned account at [Resend](https://resend.com/signup) and keep its **Free** plan. Enable account MFA.
2. In **Domains**, add an unused sending subdomain, for example `mail.brilliancyresearch.net`. Confirm your agency controls it. One agency sending domain serves all portfolios; you do not need one email-provider domain per researcher.
3. Copy the DNS records Resend displays into the domain's DNS dashboard. Add only the requested records at their specified names. Keep existing website, MX and SPF/DKIM records intact; do not replace the agency's main mailbox settings. Wait until Resend marks the domain verified.
4. In **API Keys**, create a **Sending access** key restricted to that verified domain. Keep it private.
5. On the VPS, edit `/opt/brilliancy/deploy/vps/.env` using `nano`. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` to your key, and `EMAIL_FROM` to an address on the verified domain, such as `accounts@mail.brilliancyresearch.net`. The sender is not automatically an inbox.
6. Leave AWS access keys empty for the free VPS setup. Resend does not need SES, S3 or an AWS account. Existing deployments using SES remain supported only when explicitly selected; Resend failures never fall back to SES.
7. After restarting as described below, invite a test address you control. Check receipt and the invitation link. Then request a password reset for that test account. Check Resend's delivery log and spam folder. A configured key alone does not prove delivery.

For local testing, put these settings in the root `.env` and restart `npm run dev`. Never commit either environment file or paste keys into chat. Do not use `onboarding@resend.dev` for client launch; verify your own domain.

## 2. Configure Gemini Free-tier AI

Create or select a Free-tier project in [Google AI Studio](https://aistudio.google.com/) and generate an API key. Privately edit `/opt/brilliancy/deploy/vps/.env` on the VPS:

```dotenv
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=YOUR_PRIVATE_GEMINI_KEY
```

Replace the placeholder with the actual key only in the private environment file. Newly generated VPS configurations select Gemini and this model; you must supply the key. Existing environment files, including the local root `.env`, are preserved. For local development, set the same three variables in the root `.env` and restart the development server. Keep OpenAI credentials empty for this option.

Keep the Google project on the Free tier; do not enable paid billing to bypass a quota error. Availability and quotas depend on the project and model, and exhausted quotas can interrupt extraction or summarization. Check current allowances in AI Studio. Review the [data terms](https://ai.google.dev/gemini-api/terms) before sending client CVs: unpaid services can use submitted content for product improvement.

Test CV extraction and article summarization with a document you control after applying the configuration below. Review every extracted fact before saving. Scanned PDFs may need selectable text or manual entry.

### Optional: process AI tasks in the browser

To choose browser processing instead, set `AI_PROVIDER=huggingface-browser` in the VPS environment file. Leave OpenAI and Gemini keys empty for this option.

For local development, run:

```powershell
npm run ai:browser
npm run dev
```

Stop an already running development server before restarting it. The script updates the local AI provider; it does not configure the VPS.

Use desktop Chrome or Edge on a computer with WebGPU support and sufficient GPU memory (allow roughly 3 GB). The first operation downloads roughly 1 GB of model files; keep the tab open. Test both CV extraction and article summarization with a document you control. Scanned PDFs may need selectable text or manual entry. Review every extracted fact before saving. Browser AI is slower and hardware-dependent; it cannot guarantee complete or accurate extraction. Visitors do not download the model to view portfolios.

Browser processing avoids sending CV text to a hosted AI API. It is explicitly selected, not an automatic fallback when Gemini reaches its quota.

## 3. Apply the configuration on Hostinger

For an already running deployment with the Gemini integration included, changing these environment settings needs only recreation of the web and worker containers. No image rebuild or database migration is needed for this provider switch:

```bash
cd /opt/brilliancy/deploy/vps
nano .env
docker compose config --quiet
docker compose up -d --no-build --force-recreate web worker
docker compose ps
```

This applies configuration to this application's containers; it does not change billing or purchase a service. Test an AI operation after the web service is healthy.

### First installation or application code updates

For this agency's inspected EasyPanel VPS, follow the build/start commands in [EasyPanel deployment](HOSTINGER_EASYPANEL.md), selecting **easypanel** mode. Its bounded build replaces `docker compose build` below. For other occupied servers, use [Existing VPS deployment](HOSTINGER_EXISTING_VPS.md); the [new-server guide](HOSTINGER_VPS_LAUNCH.md) is only for an empty server. These generic commands are for those other topologies:

```bash
cd /opt/brilliancy
git pull --ff-only
cd deploy/vps
nano .env
docker compose config --quiet
docker compose build web
docker compose up -d db scanner
docker compose run --rm migrate
docker compose up -d web worker caddy
docker compose ps
```

For an existing installation, make and verify a backup before updating. Do not run `configure.sh` over existing secrets, change your session secret, or delete Docker volumes. Wait for green CI on your deployment commit. Keep `DEPLOYMENT_MODE=vps`; demo mode is not a production substitute. Configure Resend before starting production: missing credentials fail startup rather than silently disabling password recovery.

After launch, test email, AI, uploads, publication and HTTPS. ClamAV is included in Compose; wait for its initial signature download. PostgreSQL and files use persistent volumes. Backups still require an independent destination and a restore test. No cPanel, paid AI API or AWS storage subscription is needed for this configuration.

No paid service has been purchased, no email sent, and no account billing changed by these repository configuration changes. The existing local environment and real credentials have been preserved; apply the selected provider's settings privately on the deployment.
