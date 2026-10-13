import { z } from "zod";
import {
  cvExtractionSchema,
  type CvExtraction,
} from "@/modules/portfolios/cv-import";
import {
  browserModel,
  cvInstructions,
  documentChunks,
  mergeCv,
  summaryInstructions,
  summarySchema,
  validateCv,
  type AiTask,
} from "./documents";

let busy = false;
export async function inferInBrowser(
  text: string,
  task: AiTask,
  progress: (text: string) => void,
  signal: AbortSignal,
) {
  if (busy)
    throw new Error(
      "Another AI task is running in this tab. Finish or cancel it first.",
    );
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> };
    }
  ).gpu;
  if (!gpu?.requestAdapter)
    throw new Error(
      "Free AI requires WebGPU. Use desktop Chrome or Edge with hardware acceleration enabled, over HTTPS or localhost. Manual editing remains available.",
    );
  signal.throwIfAborted();
  const deadline = new AbortController();
  signal = AbortSignal.any([signal, deadline.signal]);
  busy = true;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  let phase: "preparing" | "downloading" | "processing" = "preparing";
  try {
    let rejectWorker: (error: Error) => void = () => {};
    const workerFailed = new Promise<never>((_, reject) => {
      rejectWorker = reject;
    });
    const cancelled = new Promise<never>((_, reject) => {
      abort = () =>
        reject(
          new Error(
            "AI processing cancelled or timed out. You can retry with a shorter document.",
          ),
        );
      signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => deadline.abort(), 20 * 60 * 1000);
    });
    const processing = (async () => {
      if (!(await gpu.requestAdapter()))
        throw new Error(
          "This browser cannot access a compatible WebGPU GPU. Enable hardware acceleration or use another computer. No model was downloaded and no API was charged.",
        );
      progress(
        "Preparing free AI. The first use downloads roughly 1 GB of model files from Hugging Face; keep this tab open.",
      );
      phase = "downloading";
      const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
      signal.throwIfAborted();
      worker = new Worker(new URL("./browser.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener(
        "error",
        () => rejectWorker(new Error("Browser AI worker failed.")),
        { once: true },
      );
      const engine = await CreateWebWorkerMLCEngine(
        worker,
        browserModel,
        {
          initProgressCallback: (report) => progress(report.text),
          logLevel: "ERROR",
        },
        { context_window_size: 16384 },
      );
      phase = "processing";
      async function generate(
        source: string,
        schema: z.ZodType,
        instructions: string,
        maxTokens: number,
      ) {
        signal.throwIfAborted();
        const schemaText = JSON.stringify(z.toJSONSchema(schema));
        const completion = await engine.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `${instructions}\nJSON schema: ${schemaText}`,
            },
            { role: "user", content: `<document>\n${source}\n</document>` },
          ],
          temperature: 0,
          max_tokens: maxTokens,
          response_format: { type: "json_object", schema: schemaText },
        });
        const choice = completion.choices[0];
        if (choice?.finish_reason !== "stop" || !choice.message.content)
          throw new Error(
            "The model could not finish this excerpt. Try a shorter document; no partial proposal was saved.",
          );
        return schema.parse(JSON.parse(choice.message.content));
      }
      const chunks = documentChunks(text);
      if (task === "cv-import") {
        const parts: CvExtraction[] = [];
        for (const [i, chunk] of chunks.entries()) {
          progress(
            `Extracting CV excerpt ${i + 1} of ${chunks.length}. Keep this tab open.`,
          );
          parts.push(
            validateCv(
              await generate(chunk, cvExtractionSchema, cvInstructions, 6000),
            ),
          );
        }
        return mergeCv(parts);
      }
      const summaries: z.infer<typeof summarySchema>[] = [];
      for (const [i, chunk] of chunks.entries()) {
        progress(
          `Reading article excerpt ${i + 1} of ${chunks.length}. Keep this tab open.`,
        );
        summaries.push(
          summarySchema.parse(
            await generate(chunk, summarySchema, summaryInstructions, 1000),
          ),
        );
      }
      if (summaries.length === 1) return summaries[0];
      let reduced = summaries;
      while (reduced.length > 1) {
        const next: typeof summaries = [];
        for (let i = 0; i < reduced.length; i += 3) {
          progress(
            `Combining article evidence (${Math.ceil((i + 1) / 3)} of ${Math.ceil(reduced.length / 3)})…`,
          );
          next.push(
            summarySchema.parse(
              await generate(
                JSON.stringify(reduced.slice(i, i + 3)),
                summarySchema,
                `${summaryInstructions} The input contains summaries of successive excerpts of one paper. Synthesize them without adding claims. Preserve uncertainty and evidence limitations.`,
                1200,
              ),
            ),
          );
        }
        reduced = next;
      }
      const combined = reduced[0];
      combined.limitations =
        `${combined.limitations} Generated from ${chunks.length} excerpt summaries by a small browser model; verify against the original paper.`.trim();
      return summarySchema.parse(combined);
    })();
    return await Promise.race([processing, cancelled, workerFailed]);
  } catch (error) {
    if (signal.aborted || phase === "preparing") throw error;
    const hint =
      phase === "downloading"
        ? "The free browser model could not load. Check your connection, allow downloads from huggingface.co and its CDN, enable hardware acceleration, and close other GPU-heavy tabs. If it keeps failing, use the server Gemini or OpenAI option in docs/AI_SETUP.md."
        : "The browser model could not complete this document. Retry with a shorter text-based PDF, or use the server Gemini or OpenAI option in docs/AI_SETUP.md. No partial proposal was saved.";
    throw new Error(hint, { cause: error });
  } finally {
    worker?.terminate();
    clearTimeout(timer);
    if (abort) signal.removeEventListener("abort", abort);
    busy = false;
  }
}
