# Accounts to create, in order

The accounts should belong to **Brilliancy Research**, with developer access granted to you. You do not need to purchase a theme, a CMS subscription, a dedicated AI server, or a separate database product.

For CV extraction, article summaries, and the direct profile-photo upload, follow [AI setup and verification](AI_SETUP.md). It includes the Gemini free-tier alternative when browser model downloads fail, paid OpenAI setup, and an acceptance walkthrough.

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

## 6. Optional: fill a portfolio from a CV

1. Complete the OpenAI configuration in section 5. Use a model supporting PDF
   input and structured outputs. For local development, restart both `npm run dev`
   and `npm run worker` after changing `.env` (a separate worker is unnecessary
   when `RUN_WORKER=true`). Restarting the app also applies the CV-import migration
   for the local database; use `npm run db:migrate` in your deployment workflow.
2. Open a portfolio as an administrator, select **Profile**, and find **Fill from CV**.
3. Upload a PDF CV, or choose an existing PDF. Word documents must first be
   exported to PDF. Uploading alone does not send the CV to AI or publish it.
4. Select **Extract details**. This explicitly sends the PDF to OpenAI. The job
   runs in the background, including for scanned PDFs supported by your model.
5. Choose **Review extracted details** when processing finishes. Check the
   warnings, dates, links, publication status, and every academic claim. Select
   the individual records to add. Existing profile fields are protected unless
   you enable replacement and select those fields.
6. Select **Apply selected details**. This updates only your unsaved editor draft.
   Existing academic entries are retained, and records with identical title,
   institution/subtitle and start date are skipped. Edit any corrections in the
   normal editor, then **Save draft**, preview, and publish when approved.

The importer does not infer missing credentials, automatically attach the CV
to the public website, or change client permissions. AI extraction can still
misread a document, so administrator review is required. If it fails, check
the Profile error or job history under File library, verify the worker and
model configuration, and retry with a clearer or shorter PDF. A previous
successful extraction remains available. API usage is billed by OpenAI.

## 7. Portfolio design controls

New portfolios start with **Academic**, a crisp white layout with restrained blue accents, structured research, and natural portrait presentation. Existing drafts keep their chosen design; apply **Academic · Ink & Blue** to change one deliberately.

The editor follows six steps: **Profile → Academic sections → Publications → Pages → Design → Review & publish**. Save & continue saves before moving forward. Search & sharing, File library, Permissions and History sit in the Manage toolbar (or the Editing selector on phones).

Choose one of six complete designs: **Academic · Ink & Blue**, **Lumen · Sage**, **Archive · Oxblood**, **Atlas · Cobalt**, **Noir · Copper**, or **Horizon · Terracotta**. Each includes fixed colors, fonts, layout and motion. Individual font/color controls are intentionally removed. Existing saved designs remain readable; select a curated design to adopt its full settings, save and publish. The gallery provides miniature layout illustrations; use Preview for the actual saved content.

Publications has a dedicated step for papers, articles, authors, dates, abstracts and attached PDFs, including publication sections on custom pages. Upload papers or request summaries using its File library shortcut. Review AI-generated summaries before adding them to the draft. Publications are optional. Clients can only edit the root sections their administrator permits; custom pages remain administrator-controlled.

Drafts can be saved with incomplete academic entries. Publishing requires a full name and at least one visible education entry with a degree/title, institution, start date and end date (or ongoing). Visible entries also need titles. Review & publish lists missing details; the API enforces the same requirements. No qualifications or papers are fabricated to fill gaps.

Search metadata is generated from current profile content when overrides are blank. The profile portrait supplies the default sharing image. Canonical addresses, structured data and sitemaps remain automatic. **Search & sharing** shows a preview and collapsed optional controls for custom search text, navigation/footer wording and labels. Clear an override to restore automatic values. Search indexing cannot be guaranteed by metadata; demo deployments retain their noindex protection.

The default multi-page layout keeps research and contact focused, while Pages still offers a single-page layout. Publication detail pages remain separate in either mode. Public pages use static HTML and CSS, local fonts, lightweight floating shapes and progressive scroll/hover effects. Motion respects reduced-motion preferences and the site stays usable without JavaScript. The footer contains contact details and editable copyright. A custom domain such as researchbyamina.com must be registered, connected and secured separately; publishing alone does not create it.

### Profile photos and automatic background removal

1. In **Profile**, leave **Automatically remove the portrait background** enabled and upload a JPG, PNG, or WebP.
2. An image with existing transparent pixels skips model processing. For opaque portraits, the browser downloads the free [MODNet model](https://huggingface.co/Xenova/modnet) on first use and runs it locally in a worker. No paid API, API key, or GPU is required. Keep the editor open; processing speed and downloads depend on the device and connection.
3. Review the result, especially hair and clothing edges. **Use original** and **Use transparent version** switch between the two; both are in the media library. The original is never replaced by the cutout. The model provider receives model-download requests, not the photo. Normal private media uploads still go to your application server.
4. Choose **Academic · Ink & Blue** to display it without a frame. A transparent photo remains transparent with other shapes, but those may add decorative framing.
5. Save, preview, and publish. For an existing selected portrait, use **Remove background from selected photo**. Turn automatic processing off if you want to keep future uploads unchanged.

If downloads are blocked or processing fails, the original remains selected and the app explains how to retry. Cancellation also keeps the original. Clear, well-lit photos of one person work best; background removal cannot guarantee perfect edges. Scientific figures and other images uploaded through File library are not processed as portraits. Large photos are limited to 40 megapixels and processed at up to 1800 pixels on the longest side. The model is Apache-2.0 licensed; see its model card. To run the optional real-model browser check, place the official sample portrait at `.test-data/portrait-source.jpg`, set `RUN_PORTRAIT_MODEL_TEST=true`, and run `npx playwright test tests/browser/portrait.spec.ts`.

First-use downloads need a connection to `huggingface.co` and its model CDN (`*.hf.co`). The loader retries an interrupted download once and the operation has a three-minute overall limit. A successful sample cutout was verified during development, but subsequent live checks encountered CDN connection timeouts; availability of this free download service is not guaranteed by the application. Before a demonstration, process a portrait on the actual presentation browser to populate its model cache. If the CDN is unavailable, use the original photo or upload an already-transparent PNG/WebP; both paths work without the model. Ordinary automated checks cover these fallback paths; the live-model check is opt-in because it depends on the external service.

### Pages, motion, and publishing

Under **Pages → Website structure**, the default **Separate pages** layout creates
focused Home, About, Research, and Contact destinations from your content. About
contains biography, education, experience, awards, skills, and interests; Research
contains publications and projects. Empty destinations are omitted, while Contact
provides the inquiry form. Change page titles, addresses, and introductions here.
Existing custom pages remain available; matching addresses combine their sections.
You can switch to **One scrolling page** without losing content.

Under **Academic sections**, **Academic order** places education before interests,
even if education was added later or imported from a CV. Arrow controls switch to
your own sequence; **Use academic order** restores the recommended sequence. Open
a section's **Display on page** setting to place it on Home, About, Research, or
Contact. Administrators control page placement and sequence; client permissions
still govern which content they can edit.

On phones, public portfolios use a hamburger menu with native browser open/close,
outside-click dismissal, and Escape support. The editor uses an **Editing** selector
and a keyboard-accessible workspace drawer. Save, preview, and publish to apply
the new layout to an existing public portfolio; published releases are snapshots.

Motion, sticky navigation and expandable research descriptions are included in each curated design. Visitors’ reduced-motion preferences take priority. CSS effects progressively enhance the content; no animation framework is downloaded. Expandable descriptions use native HTML and work without JavaScript.
Edit their button labels under **Search & sharing**.

Choose **Save draft → Preview** to inspect your changes, then **Review & publish**
to update the public site. Existing published releases keep their design until
republished. Browser tab titles identify the workspace page, or the researcher
and current editor tab. Public pages use their SEO title or a title based on the
researcher and page/publication name.

Deletion, restoration, unpublishing, and leaving the editor through workspace
links now use in-app confirmation dialogs with Cancel as the initial focus.
Escape cancels, and keyboard focus returns to the triggering control. Browsers
may still show their own unsaved-changes warning when closing or reloading a tab;
that browser-owned safety dialog cannot be styled by the application.

Selected fonts are served locally, including from published releases. Existing
published portfolios keep their saved release until republished. For previously
provisioned custom domains, ensure the CloudFront response headers policy permits
`font-src 'self'` before republishing with web fonts; newly provisioned domains
include that policy automatically. Font licenses are in `public/fonts/licenses`.

## 8. Before the first live client

Complete `docs/OPERATIONS.md`. You need a successful deployment, confirmed email delivery, a tested model, tenant authorization tests, successful backup restoration, and an uptime alert routed to a responsible person. Choose an availability target and incident support arrangement with the agency; a cloud subscription alone is not an operational guarantee.
