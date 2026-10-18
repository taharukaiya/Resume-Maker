import { expect, it } from "vitest";
import sharp from "sharp";
import { PDFParse } from "pdf-parse";
import { emptyDocument, emptyEntry } from "../src/modules/portfolios/schema";
import {
  bodyFormat,
  formatHtml,
  formatText,
} from "../src/modules/media/article-format";
import { renderPortfolio } from "../src/modules/publishing/render";
import { shibaDocument } from "../src/modules/publishing/shiba";
import { articlePdf } from "../src/modules/publishing/article-pdf";

it.each(["existing", "new"] as const)(
  "shares image order, headings and paragraphs for %s portfolios and both article types",
  async (kind) => {
    const doc = emptyDocument(`${kind} researcher`);
    doc.theme.style = kind === "existing" ? "noir" : "shiba";
    const entry = {
      ...emptyEntry(),
      title: `${kind} article`,
      authors: "Reviewed author",
      body: "The reviewed abstract remains separate.",
      coverId: crypto.randomUUID(),
      coverAlt: "Cover image",
      images: [
        {
          mediaId: crypto.randomUUID(),
          alt: "Reviewed figure",
          caption: "Final figure",
        },
      ],
      formattedBody: [
        { kind: "heading2" as const, runs: [{ text: "Policy effects" }] },
        {
          kind: "paragraph" as const,
          runs: [
            {
              text:
                "Connected sentences.No space here. " +
                "The original evidence and its limitations must remain unchanged for every reader. ".repeat(
                  40,
                ),
              italic: true,
            },
          ],
        },
        { kind: "heading3" as const, runs: [{ text: "Further observations" }] },
        {
          kind: "paragraph" as const,
          runs: [{ text: "Final body paragraph." }],
        },
      ],
    };
    entry.fullText = formatText(entry.formattedBody);
    doc.sections = ["articles", "publications"].map((type) => ({
      id: crypto.randomUUID(),
      type: type as "articles" | "publications",
      title: type,
      intro: "",
      visible: true,
      entries: [{ ...entry, id: crypto.randomUUID() }],
    }));
    const before = JSON.stringify(doc);
    const pages = renderPortfolio(shibaDocument(doc), {
      baseUrl: `https://${kind}.test`,
      siteId: crypto.randomUUID(),
      agencyName: "Test",
      appUrl: "https://studio.test",
      asset: (id) => `https://${kind}.test/assets/${id}.webp`,
      articlePdf: (id) => `https://${kind}.test/papers/${id}.pdf`,
    });
    const image = await sharp({
      create: { width: 120, height: 60, channels: 3, background: "#1447e6" },
    })
      .png()
      .toBuffer();
    for (const section of doc.sections) {
      const article = section.entries[0];
      const route = section.type === "articles" ? "article" : "research";
      const html = pages[`${route}/${article.id}/index.html`];
      const expected = bodyFormat(article.fullText!, article.formattedBody);
      expect(expected.length).toBeGreaterThan(5);
      expect(html).toContain(formatHtml(expected));
      const cover = html.indexOf('class="entry-image article-cover"');
      const body = html.indexOf('<section class="article-text">');
      const figure = html.indexOf('<figure class="article-figure">');
      expect(cover).toBeGreaterThan(0);
      expect(cover).toBeLessThan(body);
      expect(figure).toBeGreaterThan(body);
      expect(html).toContain(`/papers/${article.id}.pdf`);
      const bytes = await articlePdf(
        article,
        `https://${kind}.test/${route}/${article.id}`,
        [
          { bytes: image, caption: "Cover position", position: "cover" },
          { bytes: image, caption: "Final figure", position: "afterBody" },
        ],
      );
      const parser = new PDFParse({ data: bytes });
      try {
        const text = (await parser.getText()).text;
        expect(text).toContain("Policy effects");
        expect(text).toContain("Further observations");
        expect(text.indexOf("Cover position")).toBeLessThan(
          text.indexOf("Policy effects"),
        );
        expect(text.indexOf("Final figure")).toBeGreaterThan(
          text.indexOf("Final body paragraph."),
        );
        expect(text).not.toMatch(/about:blank|CITE THIS ARTICLE/);
      } finally {
        await parser.destroy();
      }
    }
    expect(JSON.stringify(doc)).toBe(before);
  },
);
