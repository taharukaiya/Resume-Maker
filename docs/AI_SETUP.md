# CV extraction, article summaries, and photos

The app supports three explicit AI providers: `huggingface-browser`, `gemini`, and `openai`. Selecting one never falls back to another provider or silently enables paid billing. Keys belong in the local ignored `.env` or hosting environment settings, never Git or chat.

## Recommended choice

For a CEO demonstration with sample documents, use **Gemini on the server with a free Google AI Studio project**. It removes the browser model download and local GPU dependency. For real client documents, start with **paid OpenAI server processing**, or evaluate a paid Gemini project after reviewing its data terms. The existing queue, review screen, and field permissions work with either server provider.

The Hugging Face option runs Qwen locally through WebLLM. Initial downloads are roughly 1 GB; inference needs WebGPU and substantial available GPU memory. Download blocking, browser storage restrictions, GPU incompatibility and memory pressure can prevent loading. A small model may also fail to produce a valid proposal. Website changes cannot guarantee compatibility with every computer. This path supports text-based PDFs, not scanned documents.

## Free server AI: Gemini

1. Sign in to [Google AI Studio](https://aistudio.google.com/).
2. Open [API keys](https://aistudio.google.com/apikey), create/select a project, and create a key. Check that the project is on the **free tier**; do not enable billing for a free-only demo.
3. Check the project's available models and quota in AI Studio. The configuration below uses `gemini-3.5-flash-lite`, currently listed with a free tier. If unavailable to your account, choose an available model supporting PDFs and structured JSON and set its exact ID. Availability and quotas vary; this is not unlimited AI.
4. In your local `.env`, set these values, inserting your key privately:

   ```dotenv
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-own-key
   GEMINI_MODEL=gemini-3.5-flash-lite
   RUN_WORKER=true
   ```

5. Stop the local development server with **Ctrl+C**, then run `npm run dev`. Keep one app process per embedded local database. Do not start a separate worker against that embedded database while the app is running.
6. For Render, open your service → **Environment** → add/update `AI_PROVIDER`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. Keep `RUN_WORKER=true` for the single-service demo. Save and deploy the latest commit. Keep any future blueprint changes consistent with this provider choice; the original blueprint configures browser AI.
7. Open **Settings → Connected services** to confirm that Gemini configuration is detected. Then run the acceptance walkthrough below; detecting configuration alone is not a live AI test.

Google's pricing page marks free-tier input/output as usable to improve its products. Use synthetic, public, or appropriately redacted documents for this demo. Do not use confidential client CVs or unpublished papers on that free tier. Quota errors stop processing; a key for a different provider does not bypass them.

Gemini requests use the background worker with bounded timeouts and retries. PDFs are passed inline for CV extraction and papers without usable extracted text. This implementation limits inline Gemini PDFs to **12 MB** to allow base64/request overhead. The free Render demo has a stricter **5 MB upload limit**. Readable article text is sent as text when possible. No document is silently truncated. Very long or illegible PDFs may need compression or a shorter source.

## Paid server AI: OpenAI

1. Create an [OpenAI API project](https://platform.openai.com/), enable API billing, and create a project API key. ChatGPT Plus does not supply this app with API credits.
2. Set a project budget alert and monitor usage. Alerts should not be treated as an application-level hard spending cap.
3. Put this configuration in the local `.env` or hosting environment:

   ```dotenv
   AI_PROVIDER=openai
   OPENAI_API_KEY=your-own-key
   OPENAI_MODEL=gpt-5.4-mini
   RUN_WORKER=true
   ```

4. Restart or redeploy. For production AWS, configure the provider credentials on the dedicated **worker** as well as the web service, following `DEPLOYMENT.md` for secret storage. The standalone production worker replaces the demo's in-process worker.
5. Run the acceptance walkthrough. Compare results against representative CVs and papers before buying a more expensive model. This is a starting recommendation, not a benchmark result for your client's documents.

OpenAI processing uses structured output and native PDF input for CVs; paper summaries use extracted text when suitable and PDF input otherwise. Responses request `store: false`. Both providers' output passes portfolio validation and administrator review. Vision-capable server models can handle scanned PDFs, but poor scans can still produce omissions.

## Costs and alternatives

Indicative USD prices checked October 11, 2026; verify before purchasing. AI usage is separate from hosting, storage, domain, email and malware scanning.

| Option                                  | AI cost                                                                             | Fit                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| Hugging Face model in this browser      | No API fee; uses your computer and bandwidth                                        | Device-dependent local experiment              |
| Gemini 3.5 Flash-Lite free tier         | $0 within available project quotas                                                  | Sample-data demonstration                      |
| Gemini 3.5 Flash-Lite paid tier         | $0.30 input / $2.50 output per million text tokens                                  | Budget server alternative                      |
| OpenAI GPT-5.4 mini                     | $0.75 input / $4.50 output per million tokens                                       | Starting point for paid evaluation             |
| Hugging Face hosted Inference Providers | Free account currently gets $0.10/month credits, subject to change; then paid usage | Tiny trial allowance, not an unlimited backend |

For an illustrative **10,000 input + 2,000 output tokens per operation**, paid Gemini is about **$0.008**, and GPT-5.4 mini about **$0.0165**. One thousand such operations would be about **$8** or **$16.50**, respectively. Actual costs vary with document length, PDF images, reasoning tokens, retries and output size. These are arithmetic examples, not fixed prices per PDF.

A local model server such as Ollama is another no-API-fee option, but it needs hardware, maintenance and a securely reachable service for a hosted app; it is not integrated here. Neither a paid Hugging Face plan nor a GPU server is necessary for the implemented Gemini or OpenAI paths.

Sources: [Google pricing and data use](https://ai.google.dev/gemini-api/docs/pricing), [Gemini PDF input](https://ai.google.dev/gemini-api/docs/generate-content/file-input-methods), [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [GPT-5.4 mini capabilities and pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs), [Hugging Face credits](https://huggingface.co/docs/inference-providers/en/pricing).

## Acceptance walkthrough

1. Open **Portfolios → your portfolio → Profile → Fill from CV**.
2. Upload a sample PDF using **Upload a CV**, select it, and click **Extract details**. Server providers queue processing; the page polls for the result. Keep the app/worker running.
3. Click **Review extracted details**. Verify names, dates, institutions and links. Select the fields and records you want; click **Apply selected details**, then **Save draft**. Existing profile values are protected unless explicitly selected for replacement. This never publishes automatically.
4. In **Files & articles**, select **Research article** as the PDF purpose and upload a sample paper. Server AI starts its summary automatically. Existing PDFs also have **Generate summary**. Review the result before adding it to a publication entry. It is labeled as a generated summary, not the paper's official abstract.
5. Under **Profile → Profile photo**, use **Upload profile photo** for JPG, PNG or WebP. The image is optimized and selected automatically; confirm its preview, then **Save draft**. The existing selector lets you reuse or remove a photo selection. Files & articles remains the general media library.
6. Open **Preview** to check the photo and selected content. Publish after review.

If a server request fails, inspect the job error in the editor. A 429 means the provider quota/rate limit was reached; authentication errors need a valid server key; unavailable models need a supported model ID. Previous successful proposals remain available when a new attempt fails. If jobs never advance, check that the worker is running with the same database and AI environment.

Automated tests exercise queueing, validation, permissions, failures and review using simulated provider responses. A successful live request with your own key is still required before calling either hosted integration ready for client use.
