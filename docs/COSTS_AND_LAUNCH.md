# Costs and remaining production work

Pricing checked 11 October 2026. All figures are USD before tax. Provider prices, region, usage and plan eligibility can change. Estimates below are planning allowances, not a provider quote or a commitment to a service level.

## CEO evaluation: $0 in service charges within free limits

The prepared `render.yaml` requests a Free web service and a Free PostgreSQL database. The Hugging Face model executes on the administrator's own computer, so it has no hosted inference charge. No AI billing account or Hugging Face token is needed. Internet traffic, electricity and the administrator's hardware are still their own costs.

Render's free database expires after 30 days and its web service sleeps when idle; quotas can suspend services. This proposal does not promise indefinite free hosting. See [Render's limits](https://render.com/docs/free) and the exact [demo setup](FREE_DEMO.md).

Hugging Face's hosted Inference Providers are a different product: its current Free account row lists $0.10 in monthly credits, subject to change, followed by paid usage. This is a small trial allowance, not unlimited inference. Browser inference uses your own hardware. [Inference pricing](https://huggingface.co/docs/inference-providers/en/pricing).

If browser downloads or GPU processing fail, the app also supports Gemini server processing with a free Google AI Studio project and available quota. Use sample documents on that tier because of its data-use terms. Follow [AI setup, current model pricing and verification](AI_SETUP.md) for both Gemini and OpenAI.

## Production budget for the architecture in this repository

For an early agency deployment in Singapore, budget approximately **$400–800/month** for the AWS baseline, before major traffic growth, tax, support contracts or engineering labour. This is my rough planning estimate; create an AWS Pricing Calculator estimate for the exact region and deployment size before approving it. It assumes two web tasks, one worker, each configured at 1 vCPU/4 GB, a Multi-AZ PostgreSQL instance, and two NAT gateways running continuously. A smaller single-instance pilot can cost less but changes the availability design.

| Area                                      | Illustrative monthly allowance        | Basis / action                                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web + worker + scanner containers         | $150–220                              | Three always-running Fargate tasks; scanner resource use is included in task sizing. [Fargate pricing](https://aws.amazon.com/fargate/pricing/)                                                                                  |
| Multi-AZ database + storage               | $100–190                              | Current template uses PostgreSQL on `db.t4g.medium`, 30 GB initially. Confirm region, burst credits and backup storage. [RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/)                                            |
| NAT gateways, load balancer, IPv4         | $100–180                              | Two NAT gateways plus data processing, ALB and public address charges. [VPC pricing](https://aws.amazon.com/vpc/pricing/), [load balancing pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)                        |
| WAF                                       | $15–50 at modest traffic              | Depends on ACL count, rules and requests. Standard pricing examples use $5/ACL/month, $1/rule/month and $0.60/million requests; advanced rules cost extra. [WAF pricing](https://aws.amazon.com/waf/pricing/)                    |
| S3 and public delivery                    | $5–40 initially                       | Source files, retained releases, version history, requests and visitor downloads all count. [S3](https://aws.amazon.com/s3/pricing/), [CloudFront](https://aws.amazon.com/cloudfront/pricing/)                                   |
| Logs, secrets, alarms, additional backups | $15–60                                | Choose retention and alert volumes; verify in the calculator                                                                                                                                                                     |
| AI processing                             | Start with a $5–30 planning allowance | Actual cost is document length × selected model × request/retry count; see examples below                                                                                                                                        |
| DNS and transactional email               | Usage based                           | Route 53: $0.50/hosted zone/month for the first 25; SES outbound: $0.10/1,000 emails plus data and optional features. [DNS pricing](https://aws.amazon.com/route53/pricing/), [SES pricing](https://aws.amazon.com/ses/pricing/) |

The line-item ranges do not form a precise quote. Configure budgets and alerts from measured pilot usage. An existing agency domain needs no repurchase; its registrar still charges renewal. Separate researcher domains add their own annual renewals. Standard public TLS certificates for the deployed AWS integrations do not require buying individual website certificates; check [ACM pricing](https://aws.amazon.com/certificate-manager/pricing/) for certificate type and use.

At 100 MB of original content per researcher, 100 researchers represent roughly 10 GB of source files. Published copies, retained release versions and backups add storage. The number of visitors and PDF downloads affects transfer costs; original file size alone cannot predict the monthly bill.

## Paid AI examples after approval

The existing server path uses the OpenAI Responses API with structured outputs. Evaluate representative CVs and papers before choosing the production model; a higher price does not establish accuracy for the agency's documents.

| Example model | Input / 1 million tokens | Output / 1 million tokens | Example request: 10,000 input + 2,000 output tokens |
| ------------- | ------------------------ | ------------------------- | --------------------------------------------------- |
| GPT-5.4 mini  | $0.75                    | $4.50                     | $0.0165; 1,000 such requests ≈ $16.50               |
| GPT-5.6 Terra | $2.00                    | $12.00                    | $0.044; 1,000 such requests ≈ $44                   |

These are standard text-token examples without caching, long-context multipliers, tools or regional uplifts. Native PDF page images, reasoning tokens, longer outputs and retries can increase the actual bill. [GPT-5.4 mini pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [GPT-5.6 Terra pricing](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

The production key must belong to an agency-owned API project. Keep it in AWS Secrets Manager, set usage monitoring and choose the model explicitly. The free browser path never silently calls that paid provider.

## What the agency must supply

Ask the CEO for these details together; do not ask them to send passwords:

1. The exact agency domain, registrar, DNS provider, and who can invite you to manage DNS. Confirm the current website and email records that must be preserved.
2. An agency-owned AWS account, billing contact and payment method; root MFA and an IAM Identity Center developer role. If they have no account, follow the account steps in [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md).
3. The studio hostname, AWS region/data-location requirements, approximate portfolio count, expected traffic and number of documents processed monthly.
4. An agency-owned OpenAI API project or another approved inference provider, billing owner, document-processing consent and retention policy.
5. Sender email address and domain ownership for SES verification; someone to receive delivery/bounce/security alerts.
6. The first two administrators, MFA recovery owner, incident contact, and approved operating budget.
7. Real content and permission to process/publish it, privacy/terms/contact wording, and agreed client field permissions.
8. Required uptime, acceptable data loss and recovery time, backup retention, and a maintenance window. These are business decisions to verify with recovery tests.

## Engineering and verification needed before real clients

- Deploy the AWS stack with the agency's actual account/domain. Validate the Linux container, resource health, secrets and restricted database role. Run the documented migrations and validate web/worker/scanner operation.
- Migrate selected demo data and file objects deliberately, or create a clean production workspace. Re-publish using production addresses. Keep the demo isolated; disabling demo mode alone does not copy its files to S3.
- Verify SES production access and test real invitation, password recovery and delivery failure behaviour.
- Evaluate CV extraction and summaries with representative text and scanned PDFs, check dates/numbers/credentials, and measure latency/cost. Test the real provider; mocked tests cannot establish model quality.
- Verify DNS ownership, ACM certificates, CloudFront routing, canonical URLs, robots/sitemaps and public page performance on actual domains. Remove demo noindex rules by building/deploying the production configuration.
- Exercise both administrator and client permissions, tenant isolation, uploads, malware detection, stale edits, publishing failures, rollback, unpublish, and contact inquiries on staging.
- Restore a database backup and private file version into an isolated environment. Record recovery times. Store session-encryption recovery material securely.
- Configure alert destinations, uptime checks, backup/retention jobs, dependency patching, billing alarms and an incident owner. Run representative load tests and an independent security review before promising a service level.
- Complete client acceptance and operational handover, including admin instructions and an escalation process.

The code and automated checks are only part of launch readiness. Account ownership, provider provisioning, real inference, mail delivery, restore drills and CEO acceptance require the actual deployment and business decisions. No architecture can guarantee that nobody can cause downtime; production protection combines infrastructure controls, access discipline, monitoring and tested recovery.

Use [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md), [DEPLOYMENT.md](DEPLOYMENT.md), and [OPERATIONS.md](OPERATIONS.md) for the detailed production steps.
