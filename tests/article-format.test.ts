import { bodyFormat } from "../src/modules/media/article-format";
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

it("adds presentation paragraphs to long unformatted imports without changing words or manual formatting", () => {
  const text = Array.from(
    { length: 40 },
    (_, i) =>
      `Sentence ${i} describes the evidence and its limitations in careful detail.`,
  ).join(" ");
  const blocks = bodyFormat("Introduction\n\n" + text);
  expect(blocks[0].kind).toBe("heading2");
  expect(blocks.length).toBeGreaterThan(3);
  expect(
    blocks
      .slice(1)
      .map((b) => b.runs.map((r) => r.text).join(""))
      .join(" "),
  ).toBe(text);
  const edited = [{ kind: "paragraph" as const, runs: [{ text, bold: true }] }];
  const recovered = bodyFormat(text, edited);
  expect(recovered.length).toBeGreaterThan(1);
  expect(recovered.every((b) => b.runs.every((r) => r.bold))).toBe(true);
  expect(
    recovered.map((b) => b.runs.map((r) => r.text).join("")).join(" "),
  ).toBe(text);
  const short = [
    {
      kind: "paragraph" as const,
      runs: [{ text: "My own paragraph.", italic: true }],
    },
  ];
  expect(bodyFormat("My own paragraph.", short)).toEqual(short);
});
