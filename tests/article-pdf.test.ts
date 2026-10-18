import { expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { articlePdf } from "../src/modules/publishing/article-pdf";
import { emptyEntry } from "../src/modules/portfolios/schema";
import { printedArticle } from "./fixtures/printed-article";
it("typesets a clean uploaded article without duplicate abstract, browser footer or citation widget", async () => {
  const bytes = await articlePdf(
    {
      ...emptyEntry(),
      title: "Power and Markets",
      authors: "Ada Lovelace",
      start: "2025-02-23",
      body: "This original abstract summarizes the actual argument.",
      fullText: printedArticle,
    },
    "https://example.test/article",
  );
  const parser = new PDFParse({ data: bytes });
  try {
    const text = (await parser.getText()).text;
    expect(text.match(/original abstract/g)).toHaveLength(1);
    expect(text).not.toMatch(
      /about:blank|10\/17\/26|CITE THIS ARTICLE|typeof window|example.test/,
    );
    expect(text).toContain("Introduction");
    expect(text).toContain("Lovelace (2024)");
    await writeFile(".test-data/clean-uploaded-article.pdf", bytes);
  } finally {
    await parser.destroy();
  }
});
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
    expect(text.text.replace(/\s+/g, " ")).toContain(entry.title);
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

it("preserves a multi-page abstract with embedded website fonts", async () => {
  const paragraphs = Array.from(
    { length: 24 },
    (_, i) =>
      `Finding ${i + 1}: ` +
      "The evidence connects education policy with access to learning and carefully considers the limits of the analysis. ".repeat(
        5,
      ),
  );
  const bytes = await articlePdf(
    {
      ...emptyEntry(),
      title: "Education, opportunity and public policy",
      authors: "Raisa Ruzha Maliha",
      start: "2025-02-09",
      body: paragraphs.join("\n\n"),
      fullText: "Introduction\n\nThe reviewed body starts here.",
    },
    "https://example.test/article",
  );
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    expect(result.total).toBeGreaterThan(2);
    for (let i = 1; i <= 24; i++)
      expect(result.text.match(new RegExp(`Finding ${i}:`, "g"))).toHaveLength(
        1,
      );
    expect(result.text).toContain("The reviewed body starts here.");
    expect(result.text).not.toMatch(/about:blank|CITE THIS ARTICLE/);
    const raw = bytes.toString("latin1");
    expect(raw).toContain("Inter-Bold");
    expect(raw).toContain("Merriweather-Italic");
    await writeFile(".test-data/long-abstract-article.pdf", bytes);
  } finally {
    await parser.destroy();
  }
});
