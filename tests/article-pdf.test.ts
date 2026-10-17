import { expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { articlePdf } from "../src/modules/publishing/article-pdf";
import { emptyEntry } from "../src/modules/portfolios/schema";
it("creates a paginated research PDF containing saved authors, date, abstract, full text and figures", async () => {
  const entry = {
    ...emptyEntry(),
    title: "Coastal resilience and public policy",
    authors: "Ada Lovelace; Alan Turing",
    start: "2025-02-09",
    body: "This abstract summarizes the saved article and its observations.",
    fullText: Array(24)
      .fill(
        "Research findings\n\nObserved evidence connects coastal resilience with transparent policy decisions. These observations are presented with their limitations and should be interpreted in context.",
      )
      .join("\n\n"),
  };
  const bytes = await articlePdf(entry, "https://example.test/article/policy", [
    {
      bytes: await sharp({
        create: { width: 250, height: 120, channels: 3, background: "#1447e6" },
      })
        .png()
        .toBuffer(),
      caption: "Figure 1. Synthetic illustration.",
    },
  ]);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const parser = new PDFParse({ data: bytes });
  try {
    const text = await parser.getText();
    expect(text.total).toBeGreaterThan(1);
    expect(text.total).toBeLessThan(10);
    expect(text.pages.at(-1)!.text.length).toBeGreaterThan(50);
    expect(text.text).toContain(entry.title);
    expect(text.text).toContain(entry.authors);
    expect(text.text).toContain("2025");
    expect(text.text).toContain("Figure 1.");
    expect(text.text).toContain(entry.body);
    await mkdir(".test-data", { recursive: true });
    await writeFile(".test-data/generated-article.pdf", bytes);
  } finally {
    await parser.destroy();
  }
});
