# Brilliancy Research: from this computer to a live deployment

Follow the steps in order. Run each command separately and stop if it fails.
The agency owns the AWS account, domain and OpenAI project; you receive developer
access. This guide prepares and deploys the existing repository, not a new app.
The local database and uploads are separate from production and are not copied
by deployment. Create production accounts/content after setup; a local JSON
export alone does not transfer uploaded files.

## 1. Ask the agency for the required information

Send this message to the agency owner:

> To prepare the Brilliancy Research portfolio platform for deployment, please confirm:
>
> 1. What exact domain do you own? Which company registered it, and where is DNS managed? Who can invite me to manage the required DNS records? Does the domain currently serve a website or business email that we must preserve?
> 2. May we use a `studio` subdomain for the admin/client panel? Researchers can initially use portfolio links beneath it, with their own domains connected later.
> 3. Does the agency already have an AWS account? If yes, please have its administrator grant me named developer/deployment access through IAM Identity Center. If no, please create an agency-owned account using the agency's email, billing method and recovery details, then invite me. You retain account ownership.
> 4. Who approves the recurring AWS infrastructure costs, and what monthly budget/alert thresholds should we use? I will provide the infrastructure estimate before deployment.
> 5. Do you have an OpenAI API organization/project with API billing enabled? If yes, please invite me with the project access needed for implementation. If no, please create an agency-owned API project and billing account for CV extraction and article summaries. Who approves its usage budget? I will guide you through storing the API key securely.
> 6. Which email address should own the first administrator account, and which person/email should receive operational alerts and recovery information? Who manages your existing email DNS records so we can configure sending without disrupting mail?
>
> Please send the domain/provider names and access invitations. Do not send passwords, MFA codes, AWS root credentials or API keys in chat. We do not need another hosting, database or CMS subscription. Please arrange the accounts/access first; I will review costs and DNS changes with you before deployment.

Until they respond, complete tool installation and local checks in steps 2–3.
Do not guess their domain, billing owner or AWS account. A domain registration
alone does not grant DNS access, and AWS login alone does not grant deployment
permissions.

You need the existing domain, domain registrar, DNS provider, an agency billing
contact, and the administrator's email. Choose a studio hostname beneath that
domain. You do not need to purchase another domain, hosting plan, database
subscription or CMS.

If the domain already hosts a website or email, keep it working: export its DNS
records before changing anything. Deployment below expects a Route 53 public
hosted zone that is actually authoritative, not just an empty hosted zone.

## 2. Install and verify the development tools

Use Node.js 24, [PowerShell 7](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows),
[AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html),
and [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
Use Docker's supported WSL 2/Linux container setup and start Docker Desktop.
Restart the terminal after installation. Open **PowerShell 7**, then run:

```powershell
Set-Location 'C:\Users\user\Documents\Projects\Resume-Maker'
$PSVersionTable.PSVersion
node --version
npm.cmd --version
aws --version
docker version
```

Expected: PowerShell major version 7, Node 24, AWS CLI 2, and Docker showing
both Client and Server. A Docker Client without Server means the engine is not
ready. Resolve installation/virtualization issues before continuing.

## 3. Check the app locally

Stop the existing dev server with Ctrl+C in its terminal before installing or
building. Keep `.env`, `.data` and AWS credentials out of Git.

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run test:e2e
docker build -t brilliancy-research:preflight .
```

Expected: type checking, tests, production build, browser tests and Docker build
all succeed. Browser tests use their own database on port 3100. The Docker build
checks packaging; successful startup with AWS services is checked after deployment.

For a first local installation, run `npm.cmd run setup`, then `npm.cmd run dev`.
Open the private setup URL printed by the setup command, create the first admin,
and open `http://localhost:3000/login`. If already initialized, just sign in.
In another terminal run `npm.cmd run doctor`. This reports configuration without
printing secrets. `RUN_WORKER=true` runs local jobs inside the dev server; do not
start another process against the embedded local database.

## 4. Create the agency AWS account and developer sign-in

The agency owner creates an account at [AWS](https://aws.amazon.com/) with agency
billing/recovery details, enables root MFA, and sets billing alerts.
Enable [IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-identity-center.html)
with an organization instance that can assign access to the AWS account. Create
your developer user and assign deployment permissions to the target account.
The deployment creates IAM roles, CloudFormation stacks and network resources;
a read-only role or a basic developer role without IAM permissions is insufficient.
Have the account owner approve the deployment permission set. Do not use root
access keys. Restrict access after initial provisioning according to agency policy.

Collect the AWS access portal URL and Identity Center region. The SSO region can
differ from the application region. Configure the CLI using the
[official SSO wizard](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html):

```powershell
aws configure sso --profile brilliancy
$env:AWS_PROFILE = 'brilliancy'
$env:AWS_REGION = 'ap-southeast-1'
aws sso login --profile brilliancy
aws sts get-caller-identity
```

In the wizard, use your portal URL, actual SSO region, the default
`sso:account:access` scope, the agency account and assigned role. Use
`ap-southeast-1` for the default client region and `json` for output.
Confirm that the returned account ID belongs to Brilliancy Research.

## 5. Prepare DNS without breaking existing email or websites

Open Route 53 in the AWS console. Create or select a **public hosted zone** for
the agency domain. If moving DNS from another provider, first recreate the
existing website, MX, TXT, DKIM and other required records. Then update the
registrar's nameservers to the four Route 53 nameservers. Handle any existing
DNSSEC/DS configuration as part of the migration; stale DS records can break
resolution. Follow [AWS's existing-domain migration instructions](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html).
Do not change the domain's ownership or transfer its registration merely to use AWS.

Record the public hosted-zone ID, its domain name, and your chosen studio hostname.
The studio hostname must be inside this zone. If you must retain another DNS
provider, stop here and adapt certificate/DNS automation first; this template
assumes Route 53 controls the needed records.

## 6. Create the AI project and secret

For CV extraction and article summaries, follow section 5 of
[GETTING_STARTED.md](GETTING_STARTED.md#5-enable-ai-research-summaries): create the
agency OpenAI API project, enable API billing, and create a server-side key.
Choose a model available to your project that supports PDF inputs and structured
outputs, then evaluate it with representative CVs and papers. A ChatGPT interface
login is not the application's API configuration.

In AWS Secrets Manager in **Singapore / ap-southeast-1**, choose **Store a new
secret**, select **Other type of secret**, and add these exact key/value pairs:

| Key      | Value to enter privately                   |
| -------- | ------------------------------------------ |
| `apiKey` | The actual OpenAI project API key          |
| `model`  | The exact supported model ID you evaluated |

Save it with an agency-specific name and copy its ARN. The repository creates
database, session and first-admin secrets itself; you do not manually invent those.
Do not paste the API key into terminal history, Git, screenshots or chat.
You may skip AI initially; extraction stays disabled until the secret is attached
and the web/worker services are redeployed.

## 7. Set deployment configuration in PowerShell 7

These prompts ask for actual values, not sample domains. Use the same terminal
for the remaining deployment commands. Environment variables reset when it closes.

```powershell
$env:AWS_PROFILE = 'brilliancy'
$env:AWS_REGION = 'ap-southeast-1'
$env:BRILLIANCY_DOMAIN = Read-Host 'Exact studio hostname, without https:// or a slash'
$env:HOSTED_ZONE_NAME = Read-Host 'Route 53 public zone domain, without trailing dot'
$env:HOSTED_ZONE_ID = Read-Host 'Public hosted-zone ID, starting with Z'
$aiSecretArn = Read-Host 'AI secret ARN, or press Enter to disable AI for now'
if ($aiSecretArn) { $env:AI_SECRET_ARN = $aiSecretArn } else { Remove-Item Env:AI_SECRET_ARN -ErrorAction SilentlyContinue }
aws route53 get-hosted-zone --id $env:HOSTED_ZONE_ID --query '{Name:HostedZone.Name,Private:HostedZone.Config.PrivateZone,NameServers:DelegationSet.NameServers}'
Resolve-DnsName -Type NS $env:HOSTED_ZONE_NAME
```

Verify that `Private` is false and public DNS nameservers match the zone's
delegation. Do not run deployment against a similarly named private zone or an
undelegated duplicate zone.

## 8. Bootstrap the two AWS regions

CDK needs bootstrap resources in the application region and `us-east-1` for
edge infrastructure. These are actual AWS resources; deployment/bootstrap incur
service charges. See [CDK bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html).

```powershell
$accountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) { throw 'AWS authentication failed' }
npm.cmd exec -- cdk bootstrap "aws://$accountId/$env:AWS_REGION" "aws://$accountId/us-east-1"
npm.cmd run infra:synth
npm.cmd exec -- cdk diff --all
```

Inspect the proposed resources with the agency. The baseline includes Multi-AZ
PostgreSQL, two NAT gateways, two web tasks, a worker, scanners, load balancing,
WAF and storage. It is not free-tier hosting; agree an estimate using the AWS
pricing calculator and billing alerts before deploying. Do not destroy a stack
to solve a routine deployment error.

## 9. Deploy using the repository's script

```powershell
pwsh -File infra/deploy.ps1
```

The script deploys both stacks, writes ignored outputs to `.data/aws-outputs.json`,
runs database migrations in a private ECS task, checks the migration exit code,
and starts two web tasks plus one worker. Approve the displayed CDK changes only
after reviewing them. Wait for the final healthy message. Certificate validation
and AWS provisioning can take time; inspect CloudFormation events if it stalls.

For later deployments, schedule a maintenance window: the current infrastructure
definition sets service counts to zero during provisioning and the script starts
them after migrations. This runbook does not promise uninterrupted updates.

## 10. Verify deployment before creating clients

```powershell
$deployment = (Get-Content -LiteralPath '.data/aws-outputs.json' -Raw | ConvertFrom-Json).BrilliancyResearch
Invoke-RestMethod "$($deployment.StudioUrl)/api/status"
aws ecs describe-services --cluster $deployment.ClusterName --services $deployment.WebServiceName $deployment.WorkerServiceName --query 'services[].{Service:serviceName,Desired:desiredCount,Running:runningCount,Pending:pendingCount}'
```

Expected: the status endpoint returns JSON over HTTPS, web Desired/Running is 2,
worker Desired/Running is 1, and Pending settles at 0. This proves basic service
health, not email, AI accuracy or every custom domain.

In Secrets Manager, privately retrieve the secret identified by
`SetupTokenSecretArn` in the deployment outputs. Append the token to the studio
URL's `/setup?token=` path in your own browser, create the first administrator,
and enable MFA in **Settings & security**. Keep recovery/setup material with
the agency. Do not share that setup URL in chat or commit it.

## 11. Enable and test email

Open Amazon SES in Singapore. The stack creates a domain identity for the
hosted-zone domain and DNS verification records. Confirm identity verification
and DKIM, then request production access under SES Account dashboard. Follow
[SES production-access instructions](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).
Until approved, sandbox recipient restrictions still apply.

The app sends from `noreply` at the hosted-zone domain. Preserve existing MX and
mail-provider DNS. Configure SPF/custom MAIL FROM and DMARC as appropriate to the
agency's existing mail setup. Test an invitation and password recovery to an
actual recipient and check delivery/spam folders; do not assume verified DNS
alone means delivery is working.

## 12. Run one complete pilot portfolio

Create an internal pilot researcher and client account. Configure that client's
editable fields. Upload a portrait and PDF CV; run Fill from CV, review facts,
apply selected fields and save. Upload a paper and review its summary. Choose a
design, preview both screen sizes, and publish. Verify the public page, download
links, local fonts, inquiry form, custom pages, canonical URL and sitemap.
Sign in as the client to check permitted edits and that admin actions are denied.
Create another disposable draft and test typed-confirmation deletion.

For a researcher's own domain, follow
[the custom-domain procedure](DEPLOYMENT.md#connecting-an-individual-researcher-domain).
It requires domain-owner DNS changes and an ACM certificate in `us-east-1`.
First prove the `/p/slug` version works; add the domain afterward.

## 13. Finish the launch checks

Complete [OPERATIONS.md](OPERATIONS.md): real backup restoration in isolation,
external uptime alerts routed to a responsible person, upload scanning, failed
job recovery, secret recovery, and a security review. Document who responds to
incidents and the agency's retention policy. Do not claim the platform is ready
for paying clients until these live checks pass.

Draft deletion is available to admins under **Review & publish** for portfolios
that have never been published. It retains immutable audit events and the client
account. Uploaded files and failed-release files are removed by a retryable worker
queue. S3 versions and database backups remain subject to retention. Operators
should monitor `storage_cleanup` for rows with repeated attempts/errors; do not
remove queue rows to hide a failure. Published portfolio removal is a separate
offline/retention procedure described in OPERATIONS.md.

## When a step fails

| Symptom                             | Next check                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `aws` / `pwsh` / `docker` not found | Install the tool, reopen the terminal, repeat step 2                                     |
| SSO expired or AccessDenied         | `aws sso login --profile brilliancy`; confirm account and deployment role                |
| Certificate stays pending           | Authoritative DNS, hosted-zone ID and ACM validation records                             |
| Docker build fails                  | Docker Linux engine, build output, registry connectivity                                 |
| Migration task fails                | ECS stopped-task reason and MigrationTask CloudWatch log; do not start services manually |
| Service does not stabilize          | ECS task events, container logs, database/secrets access and scanner health              |
| Invitations do not arrive           | SES region, identity, sandbox approval and recipient delivery logs                       |
| AI disabled or extraction fails     | AI secret keys/model, account billing, redeployment and worker job error                 |
| Deleted draft files remain          | Worker health and `storage_cleanup` retry errors; backups are retained separately        |

Deployment has not occurred merely because local tests or CDK synthesis pass.
Keep the last successful commit, deployment outputs and operator notes available
to the agency, without publishing secrets.
