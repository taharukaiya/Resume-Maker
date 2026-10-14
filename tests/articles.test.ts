import { describe, expect, it } from "vitest";
import {
  emptyDocument,
  emptyEntry,
  documentSchema,
  canEditDocument,
} from "../src/modules/portfolios/schema";
import { renderPortfolio } from "../src/modules/publishing/render";
import {
  articleCitation,
  citationStyles,
} from "../src/modules/publishing/citations";
import { shibaDocument } from "../src/modules/publishing/shiba";
import {
  shibaScript,
  shibaScriptSource,
} from "../src/modules/publishing/shiba-script";
import { createHash } from "node:crypto";
const options = {
  baseUrl: "https://research.example",
  agencyName: "Agency",
  siteId: crypto.randomUUID(),
  appUrl: "https://studio.example",
  asset: (id: string) => `https://research.example/assets/${id}.pdf`,
};
function fixture() {
  const doc = emptyDocument("Researcher");
  const article = {
    ...emptyEntry(),
    title: "Evidence & risk",
    authors: "Ada Lovelace; Alan Turing",
    start: "2025-02-09",
    body: "An author-written abstract.",
    fullText: "A full article.\n\nMethods and findings.",
    category: "Finance",
    journal: "Research Journal",
    volume: "2",
    issue: "3",
    pages: "10–20",
    mediaId: crypto.randomUUID(),
  };
  doc.sections = [
    {
      id: crypto.randomUUID(),
      type: "articles",
      title: "Articles",
      visible: true,
      intro: "",
      entries: [article],
    },
  ];
  return { doc, article };
}
describe("Fixed Shiba design and articles", () => {
  it("uses one design for current drafts while supporting old saved settings", () => {
    const { doc } = fixture();
    doc.theme.style = "noir";
    const html = renderPortfolio(shibaDocument(doc), options)["index.html"];
    expect(html).toContain('class="shiba"');
    expect(html).toContain("font-family:Inter");
    expect(doc.theme.style).toBe("noir");
    expect(emptyDocument("New").theme.style).toBe("shiba");
  });
  it("publishes a searchable archive, editable full text, PDF download and citation tabs with legacy URL aliases", () => {
    const { doc, article } = fixture();
    const pages = renderPortfolio(doc, options);
    const page = pages[`article/${article.id}/index.html`];
    expect(page).toContain("Methods and findings.");
    expect(page).toContain("9 Feb 2025");
    expect(page).toContain("Download as PDF");
    expect(page).toContain(options.asset(article.mediaId));
    for (const style of citationStyles)
      expect(page).toContain(`>${style}</button>`);
    expect(pages[`publications/${article.id}/index.html`]).toBe(page);
    expect(pages["article/index.html"]).toContain("data-archive");
    expect(pages["sitemap.xml"]).toContain(`/article/${article.id}`);
    expect(pages["sitemap.xml"]).not.toContain("/publications/");
  });
  it("does not expose hidden articles, their full text, authors or links", () => {
    const { doc, article } = fixture();
    doc.navigation.articlesEnabled = false;
    const pages = renderPortfolio(doc, options);
    expect(pages["article/index.html"]).toBeUndefined();
    expect(pages[`article/${article.id}/index.html`]).toBeUndefined();
    expect(pages["index.html"]).not.toContain(article.title);
    expect(pages["index.html"]).not.toContain(article.mediaId);
    doc.navigation.articlesEnabled = true;
    doc.sections[0].visible = false;
    expect(renderPortfolio(doc, options)["article/index.html"]).toBeUndefined();
  });
  it("escapes article markup and allows only the constant interaction script", () => {
    const { doc, article } = fixture();
    article.fullText = "<script>alert(1)</script>";
    article.title = '</script><img onerror="alert(1)">';
    const page = renderPortfolio(doc, options)[
      `article/${article.id}/index.html`
    ];
    expect(page).not.toContain("<script>alert(1)");
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(shibaScriptSource).toBe(
      `'sha256-${createHash("sha256").update(shibaScript).digest("base64")}'`,
    );
    expect(shibaScript).not.toContain(article.title);
  });
  it("uses publication date and DOI in citations and leaves missing dates unspecified", () => {
    const { article } = fixture();
    for (const style of citationStyles) {
      const citation = articleCitation(
        article,
        `https://research.example/article/${article.id}`,
        style,
      );
      expect(citation).toContain("2025");
      expect(citation).toContain("Evidence & risk");
    }
    article.doi = "10.1234/risk";
    expect(articleCitation(article, options.baseUrl, "APA")).toContain(
      "https://doi.org/10.1234/risk",
    );
    article.start = "";
    expect(articleCitation(article, options.baseUrl, "APA")).toContain(
      "(n.d.)",
    );
    expect(articleCitation(article, options.baseUrl, "BibTeX")).not.toContain(
      "year =",
    );
  });
  it("reserves article routes and keeps article visibility administrator-controlled", () => {
    const { doc } = fixture();
    const changed = structuredClone(doc);
    changed.navigation.articlesEnabled = false;
    expect(canEditDocument(doc, changed, ["sections.publications"])).toBe(
      false,
    );
    doc.pages = [
      {
        id: crypto.randomUUID(),
        slug: "article",
        title: "Conflict",
        description: "",
        sections: [],
      },
    ];
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
});
