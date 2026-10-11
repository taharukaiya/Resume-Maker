import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithGemini } from "../src/modules/ai/gemini";
import { summarySchema } from "../src/modules/ai/documents";
import { aiConfig } from "../src/modules/ai/config";

const summary = {
  abstract: "A factual research summary.",
  keywords: ["research"],
  limitations: "Review against the source.",
};
const request = {
  bytes: Buffer.from("%PDF-fixture"),
  instructions: "Use document evidence only.",
  schema: summarySchema,
  maxTokens: 4096,
};
const answer = (value: unknown, finishReason = "STOP") =>
  new Response(
    JSON.stringify({
      candidates: [
        { finishReason, content: { parts: [{ text: JSON.stringify(value) }] } },
      ],
    }),
  );
beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "unit-test-key-never-sent");
  vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash-lite");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Server Gemini document processing", () => {
  it("sends PDFs with a private header and schema, and validates the response", async () => {
    const fetch = vi.fn().mockResolvedValue(answer(summary));
    vi.stubGlobal("fetch", fetch);
    expect(aiConfig().server).toBe(true);
    expect(await generateWithGemini(request)).toEqual(summary);
    const [url, init] = fetch.mock.calls[0];
    expect(url).not.toContain("unit-test-key");
    expect(init.headers["x-goog-api-key"]).toBe("unit-test-key-never-sent");
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe(
      "application/pdf",
    );
    expect(body.generationConfig.responseJsonSchema.type).toBe("object");
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
  });
  it("uses extracted article text when available instead of duplicating PDF input", async () => {
    const fetch = vi.fn().mockResolvedValue(answer(summary));
    vi.stubGlobal("fetch", fetch);
    await generateWithGemini({ ...request, text: "Source article evidence." });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts).toEqual([
      { text: "<document>\nSource article evidence.\n</document>" },
    ]);
  });
  it("rejects truncation and invalid output rather than returning partial proposals", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(answer(summary, "MAX_TOKENS"))
        .mockResolvedValueOnce(answer({ abstract: 42 })),
    );
    await expect(generateWithGemini(request)).rejects.toThrow("did not finish");
    await expect(generateWithGemini(request)).rejects.toThrow(
      "invalid proposal",
    );
  });
  it("reports quota errors without leaking provider content or falling back", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("secret provider diagnostic", { status: 429 }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(generateWithGemini(request)).rejects.toThrow(
      "Quota or rate limit reached",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("requires explicit configuration and bounds inline PDF size", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      generateWithGemini({ ...request, bytes: Buffer.alloc(13 * 1024 * 1024) }),
    ).rejects.toThrow("12 MB");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "different-provider-key");
    vi.stubEnv("OPENAI_MODEL", "different-provider-model");
    expect(aiConfig().enabled).toBe(false);
    await expect(generateWithGemini(request)).rejects.toThrow(
      "Configure GEMINI_API_KEY",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
