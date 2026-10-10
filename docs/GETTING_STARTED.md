# Accounts to create, in order

The accounts should belong to **Brilliancy Research**, with developer access granted to you. You do not need to purchase a theme, a CMS subscription, a dedicated AI server, or a separate database product.

## 1. Run the application locally first

1. Open a terminal in this project.
2. Run `npm ci`, then `npm run setup`.
3. Save the generated setup link privately. The token grants initial administrator creation until setup finishes.
4. Run `npm run dev` and open that link.
5. Enter your real administrator name, email, and password. Enable MFA from Settings & security.
6. Use People & access to invite a client, then create a portfolio and assign the client in Permissions.
7. Check only the fields the client should edit. The client cannot publish, change permissions, or modify the design.

Local development needs no cloud account. Without email configured, an administrator can copy the actual single-use invitation link and deliver it privately. AI generation is disabled until an API account is connected; original abstracts can always be entered manually.

## 2. Create an AWS account

1. Visit [AWS account setup](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html).
2. Use an agency-owned email address and billing method. Keep the recovery details with the agency owner.
3. Enable a passkey/security key or MFA for the root account.
4. Set up IAM Identity Center and invite your developer identity. Use that identity for daily work instead of the root login.
5. Create AWS billing alerts at spending thresholds the agency chooses. Budget notifications are alerts, not a guaranteed spending cap.
6. Use `ap-southeast-1` (Singapore) for the main application initially. CloudFront serves published content globally. CloudFront certificates and the global WAF live in `us-east-1`.
7. Do not buy separate S3, database, or email subscriptions. These are services inside the AWS account, provisioned by the infrastructure code.

Official guidance: [AWS account security](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started-account-iam.html).

## 3. Establish the domain

1. Use the domain Brilliancy Research already owns. Record the domain name and its current DNS provider; no additional domain purchase is necessary.
2. Choose an admin subdomain, for example a `studio` subdomain under the agency's actual domain.
3. In Route 53, create or identify the public hosted zone for that domain.
4. If moving DNS to Route 53, preserve existing mail and website records before changing nameservers.
5. Record the hosted-zone ID, hosted-zone name, and chosen studio hostname. These are not secrets.

## 4. Enable email with Amazon SES

1. Deploy the AWS infrastructure using the deployment guide. It creates an SES identity and DNS verification records.
2. Open SES in the same application region. Confirm that the domain identity is verified.
3. Request SES production access for transactional account invitations and password recovery. Describe these actual use cases.
4. Configure and monitor DKIM, SPF/custom MAIL FROM as appropriate, and DMARC for the agency domain. Preserve existing email-provider records.
5. Test invitations and recovery with a real recipient. The app’s sender is `noreply` at the configured agency domain.

SES starts in a sandbox with recipient restrictions; identity verification alone does not remove the sandbox. [AWS production-access instructions](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## 5. Enable AI research summaries

1. Create an account at the [OpenAI API platform](https://platform.openai.com/).
2. Create an API project for Brilliancy Research and configure API billing.
3. Create a server-side API key restricted to the services the application needs. The application uses the Responses API.
4. Choose a model supporting PDF input and structured outputs. The current implementation supports a model ID supplied through `OPENAI_MODEL`; evaluate it on representative papers before approving its use.
5. Create a secret in AWS Secrets Manager in the application region. Store a JSON object with two fields: `apiKey` containing the real API key and `model` containing the selected model ID.
6. Set `AI_SECRET_ARN` to that secret’s ARN and rerun the deployment workflow. Do not place the key in source files, public environment variables, screenshots, or chat messages.
7. Upload a real paper with the research article purpose selected. This automatically queues a summary when AI is connected. Check objective/methods/results/numbers/limitations, then add the approved result to the publication draft. Use Generate summary to regenerate it when needed.

For local evaluation, set `OPENAI_API_KEY` and `OPENAI_MODEL` in the ignored `.env` file, then restart the dev server. This is a real external API call and incurs usage charges.

Sources: [OpenAI API authentication](https://developers.openai.com/api/reference/overview), [PDF inputs](https://developers.openai.com/api/docs/guides/file-inputs), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## 6. Before the first live client

Complete `docs/OPERATIONS.md`. You need a successful deployment, confirmed email delivery, a tested model, tenant authorization tests, successful backup restoration, and an uptime alert routed to a responsible person. Choose an availability target and incident support arrangement with the agency; a cloud subscription alone is not an operational guarantee.
