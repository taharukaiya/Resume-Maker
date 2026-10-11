import { z } from "zod";
import { invariant } from "@/lib/errors";

/** Server-only, explicit provider choice. No browser key or paid fallback. */
export async function generateWithGemini<T>(options: {
  bytes: Buffer;
  text?: string;
  instructions: string;
  schema: z.ZodType<T>;
  maxTokens: number;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  invariant(
    apiKey && model && /^[a-zA-Z0-9._-]+$/.test(model),
    503,
    "Configure GEMINI_API_KEY and a valid GEMINI_MODEL on the server.",
  );
  // Leave room for base64 expansion, instructions and schema in an inline request.
  invariant(
    options.text || options.bytes.length <= 12 * 1024 * 1024,
    400,
    "Gemini PDF processing accepts up to 12 MB here. Compress this PDF and try again.",
  );
  const schema = z.toJSONSchema(options.schema);
  delete schema.$schema;
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.instructions }] },
          contents: [
            {
              role: "user",
              parts: options.text
                ? [{ text: `<document>\n${options.text}\n</document>` }]
                : [
                    {
                      inlineData: {
                        mimeType: "application/pdf",
                        data: options.bytes.toString("base64"),
                      },
                    },
                  ],
            },
          ],
          generationConfig: {
            maxOutputTokens: options.maxTokens,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
          },
        }),
      },
    );
  } catch {
    throw new Error(
      "Gemini could not be reached or timed out. The worker will retry; check the server's internet connection.",
    );
  }
  // Never persist provider error bodies: they can echo document content or keys.
  if (!response.ok) {
    await response.body?.cancel();
    const detail =
      response.status === 429
        ? "Quota or rate limit reached. Check this project's limits in Google AI Studio and retry after the quota resets."
        : [401, 403].includes(response.status)
          ? "Check the server API key, API permissions and regional availability."
          : response.status === 404
            ? "The configured model is unavailable. Check GEMINI_MODEL in the server environment."
            : response.status === 400
              ? "The document or response schema was rejected. Check model support or try a shorter PDF."
              : "The provider is temporarily unavailable. The worker will retry.";
    throw new Error(`Gemini (${response.status}): ${detail}`);
  }
  const result = (await response.json()) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string; thought?: boolean }[] };
    }[];
  };
  const candidate = result.candidates?.[0];
  invariant(
    candidate?.finishReason === "STOP",
    422,
    "Gemini did not finish a complete proposal. Try a shorter, clearer PDF; previous results are unchanged.",
  );
  const text = candidate.content?.parts
    ?.filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("");
  try {
    return options.schema.parse(JSON.parse(text || ""));
  } catch {
    throw new Error(
      "Gemini returned an invalid proposal. No partial result was saved; retry with a clearer document.",
    );
  }
}
