import { afterEach, describe, expect, it, vi } from "vitest";
import { aiConfig } from "../src/modules/ai/config";
import {
  documentChunks,
  mergeCv,
  validateCv,
} from "../src/modules/ai/documents";
import { assertProductionConfig } from "../src/lib/config";
import {
  readBrowserDocument,
  readPdfLinkEvidence,
} from "../src/modules/ai/pdf";
import { textPdf } from "./pdf-fixture";

afterEach(() => vi.unstubAllEnvs());
describe("Free AI and demo boundaries", () => {
  it("includes PDF annotation destinations even when the visible caption hides the URL", async () => {
    const pdf = textPdf(
      [
        "LinkedIn",
        "Synthetic researcher curriculum vitae. Education: MSc in environmental science.",
        "Research interests: environmental modelling, scientific communication and testing.",
      ],
      { label: "LinkedIn", url: "https://www.linkedin.com/in/test-researcher" },
    );
    expect(await readPdfLinkEvidence(pdf)).toContain(
      "https://www.linkedin.com/in/test-researcher",
    );
    expect(await readBrowserDocument(pdf, "cv-import")).toContain(
      "https://www.linkedin.com/in/test-researcher",
    );
  });
  it("extracts real PDF text and rejects a PDF without sufficient text", async () => {
    const text = await readBrowserDocument(
      textPdf([
        "Sample researcher CV for integration testing.",
        "Education: Master of Science, 2022. Research: environmental modelling.",
        "Experience: Research Assistant, 2023 to 2024. No personal information is included.",
      ]),
      "cv-import",
    );
    expect(text).toContain("Master of Science, 2022");
    await expect(readBrowserDocument(textPdf([]), "cv-import")).rejects.toThrow(
      "too little readable text",
    );
  });
  it("enables browser inference without API keys and never enables an unknown provider", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "");
    vi.stubEnv("AI_PROVIDER", "huggingface-browser");
    expect(aiConfig().enabled).toBe(true);
    vi.stubEnv("AI_PROVIDER", "unknown");
    expect(aiConfig().enabled).toBe(false);
  });
  it("chunks a multilingual document without losing characters", () => {
    const source = "Research evidence.\nবাংলা গবেষণা資料 ".repeat(600);
    const chunks = documentChunks(source);
    expect(chunks.join("")).toBe(source);
    expect(chunks.every((c) => c.length <= 4501)).toBe(true);
  });
  it("preserves conflicting CV facts for review and rejects unsafe URLs", () => {
    const first = {
      profile: {
        name: "Test One",
        headline: "",
        affiliation: "",
        bio: "",
        location: "",
        email: "",
        links: [],
      },
      sections: [],
      warnings: [],
    };
    const second = structuredClone(first);
    second.profile.name = "Test Two";
    const result = mergeCv([first, second]);
    expect(result.profile.name).toBe("Test One");
    expect(result.warnings.join(" ")).toContain("Conflicting name");
    expect(() =>
      validateCv({
        ...first,
        profile: {
          ...first.profile,
          links: [{ label: "Unsafe", url: "javascript:alert(1)" }],
        },
      }),
    ).toThrow();
  });
  it("keeps production requirements and HTTPS in demo mode", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEPLOYMENT_MODE", "demo");
    vi.stubEnv("DATABASE_URL", "postgresql://example.test/demo");
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("PUBLIC_BUCKET", "");
    vi.stubEnv("DATABASE_SECRET_ARN", "");
    vi.stubEnv(
      "SESSION_SECRET",
      "test-only-secret-with-more-than-32-characters",
    );
    vi.stubEnv("APP_URL", "https://demo.example.test");
    expect(() => assertProductionConfig()).not.toThrow();
    vi.stubEnv("APP_URL", "http://demo.example.test");
    expect(() => assertProductionConfig()).toThrow("HTTPS");
    vi.stubEnv("APP_URL", "https://demo.example.test");
    vi.stubEnv("DEPLOYMENT_MODE", "");
    expect(() => assertProductionConfig()).toThrow(
      "Production configuration missing",
    );
  });
});
