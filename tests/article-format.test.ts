import { expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { writeFile } from "node:fs/promises";
import {
  articleFormatSchema,
  formatHtml,
  formatText,
  matchingFormat,
  type ArticleFormat,
} from "../src/modules/media/article-format";
import { articlePdf } from "../src/modules/publishing/article-pdf";
import { emptyEntry } from "../src/modules/portfolios/schema";

const blocks: ArticleFormat = [
  { kind: "heading2", runs: [{ text: "Research findings" }] },
  {
    kind: "paragraph",
    runs: [
      { text: "Evidence supports ", bold: true },
      { text: "careful interpretation", italic: true, color: "#1447e6" },
      { text: " and transparent reporting.", underline: true },
    ],
  },
  { kind: "number", runs: [{ text: "Review the evidence." }] },
  { kind: "number", runs: [{ text: "Explain the limitations." }] },
];
it("escapes pasted markup, rejects unsafe colors and ignores stale formatting", () => {
  expect(
    formatHtml([
      {
        kind: "paragraph",
        runs: [{ text: '<img src=x onerror="alert(1)">', bold: true }],
      },
    ]),
  ).toContain("&lt;img");
  expect(
    articleFormatSchema.safeParse([
      {
        kind: "paragraph",
        runs: [{ text: "x", color: "red; background:url(x)" }],
      },
    ]).success,
  ).toBe(false);
  expect(matchingFormat(formatText(blocks), blocks)).toEqual(blocks);
  expect(matchingFormat("A later manual correction", blocks)).toBeUndefined();
  expect(formatHtml(blocks)).toContain("<p>2. Explain the limitations.</p>");
});
it("typesets formatted headings and runs without losing body text or adding browser footers", async () => {
  const bytes = await articlePdf(
    {
      ...emptyEntry(),
      title: "Formatted research",
      fullText: formatText(blocks),
      formattedBody: blocks,
    },
    "https://example.test",
  );
  const parser = new PDFParse({ data: bytes });
  try {
    const text = (await parser.getText({ pageJoiner: "" })).text;
    expect(text).toContain("careful interpretation");
    expect(text).toContain("2. Explain the limitations.");
    expect(text).not.toMatch(/about:blank|CITE THIS ARTICLE/);
    await writeFile(".test-data/formatted-article.pdf", bytes);
  } finally {
    await parser.destroy();
  }
});
