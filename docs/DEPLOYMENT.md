# AWS deployment

This provisions paid AWS resources. Start only after the agency account, domain, and billing arrangements exist. The CDK template can be synthesized locally, but the live deployment requires AWS credentials and Docker.

## Workstation prerequisites

Install Node.js 24 LTS, Docker Desktop, AWS CLI v2, and PowerShell 7. Start Docker. Sign in using your agency-granted AWS SSO identity (`aws configure sso`, then `aws sso login`). Do not create or use root access keys.

Use the real agency values for these environment variables in your terminal:

- `AWS_REGION`: `ap-southeast-1` for the main application.
- `BRILLIANCY_DOMAIN`: the chosen studio hostname.
- `HOSTED_ZONE_ID`: the existing Route 53 public zone ID.
- `HOSTED_ZONE_NAME`: that zone’s domain name, without a trailing dot.
- `AI_SECRET_ARN`: optional; an existing secret with `apiKey` and `model` fields.

No values in this list are a shared default deployment credential.

## Bootstrap and deploy

1. Run `npm ci`.
2. Confirm the account with `aws sts get-caller-identity`.
3. Bootstrap CDK in both application and edge regions. In PowerShell:

```powershell
$accountId = aws sts get-caller-identity --query Account --output text
npm exec -- cdk bootstrap "aws://$accountId/$env:AWS_REGION" "aws://$accountId/us-east-1"
npm run infra:synth
```

4. Review the synthesized resources and estimated AWS cost. The production baseline includes two NAT gateways, private application subnets, isolated database subnets, a Multi-AZ PostgreSQL instance, two web tasks, a worker, ClamAV sidecars, load balancer, certificates, S3, CloudFront, WAF, SES, secrets, and retained logs. These have ongoing costs even with little traffic.
5. Run the deployment script from the project root:

```powershell
pwsh -File infra/deploy.ps1
```

6. Approve the CDK infrastructure changes when prompted. The script provisions the infrastructure, runs the migration task in the private VPC, verifies its exit code, and starts the web and worker services.
7. The output prints the studio URL and setup-token secret ARN. Retrieve the secret privately from AWS Secrets Manager. Open the studio’s `/setup?token=` URL with that value appended, then create the first administrator.
8. Enable MFA immediately. Production admin actions are blocked until MFA is enrolled.
9. Complete SES production-access approval and test real mail.

The runtime database role has row-level operation grants on application tables, not PostgreSQL superuser or schema ownership. Only the migration task can read the database administrator secret. The runtime may insert and read audit records but cannot update or delete them.

## Connecting an individual researcher domain

1. Publish the portfolio on its studio `/p/slug` URL once.
2. Add the custom hostname in Review & publish → Custom domains.
3. Create the displayed `_brilliancy` TXT record at the domain’s DNS provider. Click Verify DNS record.
4. Request an ACM certificate **in us-east-1**, covering the exact hostname. Add ACM’s DNS-validation CNAME records and wait for certificate status ISSUED.
5. Run the provisioner inside the private VPC, using the `DomainOperatorTaskArn`, cluster, subnet IDs, and security-group ID from `.data/aws-outputs.json`. Do not expose the database publicly to run this from a laptop.
6. Use `infra/domain.ps1`:

```powershell
pwsh -File infra/domain.ps1 -Hostname $researcherHostname -CertificateArn $issuedCertificateArn
```

7. Read the `DomainOperator` CloudWatch stream. It returns the CloudFront hostname. Create a CNAME for a subdomain or a Route 53 ALIAS for an apex domain. Keep the TXT and ACM validation records.
8. Wait for CloudFront to report Deployed and for DNS to resolve correctly. Activate the domain:

```powershell
pwsh -File infra/domain.ps1 -Hostname $researcherHostname -CertificateArn $issuedCertificateArn -Activate
```

9. Republish the portfolio. Navigation and canonical URLs then use the activated hostname, and subsequent publications update CloudFront automatically. Test HTTPS, article pages, files, sitemap, contact form, and mobile layout.

The first activated domain is canonical. CloudFront certificate issuance, domain ownership, and DNS propagation require the real domain owner and cannot be verified in a local test.

## Future releases

Run all checks, then run `infra/deploy.ps1` again. Migrations must be backward-compatible with the currently running application. The script applies migrations before rolling services. Do not edit an applied SQL migration; add a new numbered file. Preserve retained secrets and buckets across deployments.

Review the container base and ClamAV image for updates, then validate a new immutable image in staging. The CDK synthesis test checks resource configuration; it does not execute Docker or prove the container starts successfully on AWS.

## Environment reference

| Variable                                                | Purpose                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `APP_URL`                                               | Exact HTTPS studio origin; also the CSRF allowed origin         |
| `DATABASE_URL`                                          | Direct PostgreSQL URL, or use the database secret configuration |
| `DATABASE_SECRET_ARN`, `DATABASE_HOST`, `DATABASE_NAME` | Load runtime database credentials from Secrets Manager          |
| `SESSION_SECRET`                                        | Stable encryption key, at least 32 characters                   |
| `SETUP_TOKEN`                                           | First-admin setup secret; unused after first setup              |
| `S3_BUCKET`                                             | Private original uploads and live release manifests             |
| `PUBLIC_BUCKET`                                         | Approved release HTML and copied public media                   |
| `PUBLIC_ASSET_URL`                                      | Asset-only CloudFront HTTPS origin                              |
| `AWS_REGION`                                            | Main AWS service region                                         |
| `EMAIL_FROM`                                            | Verified SES sender identity                                    |
| `OPENAI_API_KEY`, `OPENAI_MODEL`                        | Server-only summary integration                                 |
| `CLAMAV_HOST`, `CLAMAV_PORT`                            | Private ClamAV INSTREAM endpoint                                |
| `RUN_WORKER`                                            | `true` only for the single-process local development worker     |
| `CLOUDFRONT_WAF_ARN`                                    | Global ACL used by the domain provisioner                       |

Production startup rejects missing required infrastructure configuration. Logs intentionally avoid credential values. The setup secret and generated invitation links must remain private.
