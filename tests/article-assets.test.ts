import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { extractArticleAssets } from "../src/modules/media/article-assets";
import {
  collectAssetIds,
  emptyDocument,
  emptyEntry,
} from "../src/modules/portfolios/schema";
import { renderPortfolio } from "../src/modules/publishing/render";

describe("Article figures and distinct research", () => {
  it("extracts a real embedded image and editable text without an AI provider", async () => {
    const extracted = await extractArticleAssets(
      await readFile("tests/fixtures/article-figure.pdf"),
    );
    expect(extracted.images).toHaveLength(1);
    expect(extracted.images[0].subarray(8, 12).toString()).toBe("WEBP");
    expect(extracted.text).toContain("Article figure verification");
  });
  it("keeps research available when articles are disabled and collects editable figure assets", () => {
    const doc = emptyDocument("Test researcher");
    const figure = crypto.randomUUID();
    const paper = { ...emptyEntry(), title: "Research only" };
    const article = {
      ...emptyEntry(),
      title: "Article only",
      images: [
        {
          mediaId: figure,
          alt: "<script>image</script>",
          caption: "<b>Caption</b>",
        },
      ],
    };
    doc.sections = [
      {
        id: crypto.randomUUID(),
        type: "publications",
        title: "Research",
        intro: "",
        visible: true,
        entries: [paper],
      },
      {
        id: crypto.randomUUID(),
        type: "articles",
        title: "Articles",
        intro: "",
        visible: true,
        entries: [article],
      },
    ];
    const options = {
      baseUrl: "https://example.test",
      asset: (id: string) => `https://example.test/assets/${id}.webp`,
      siteId: crypto.randomUUID(),
      agencyName: "Agency",
      appUrl: "https://studio.test",
    };
    expect(collectAssetIds(doc)).toContain(figure);
    let pages = renderPortfolio(doc, options);
    expect(pages["research/index.html"]).not.toContain(article.title);
    expect(pages["article/index.html"]).not.toContain(paper.title);
    expect(pages[`article/${article.id}/index.html`]).toContain(
      "&lt;b&gt;Caption&lt;/b&gt;",
    );
    expect(pages[`article/${article.id}/index.html`]).not.toContain(
      "<script>image",
    );
    expect(pages[`article/${article.id}/index.html`]).not.toContain(
      '<section class="abstract article-text">',
    );
    doc.navigation.articlesEnabled = false;
    pages = renderPortfolio(doc, options);
    expect(pages["article/index.html"]).toBeUndefined();
    expect(pages["research/index.html"]).toContain(paper.title);
    expect(pages["index.html"]).not.toContain(article.title);
  });
});
