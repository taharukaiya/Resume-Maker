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
  it("reflows abstract line wrapping without changing paragraphs or allowing markup", () => {
    const { doc, article } = fixture();
    article.body =
      "Evidence across\ncoastal communities.\n\nA second paragraph <script>bad</script>.";
    const pages = renderPortfolio(doc, options);
    expect(pages[`article/${article.id}/index.html`]).toContain(
      "<p>Evidence across coastal communities.</p><p>A second paragraph &lt;script&gt;bad&lt;/script&gt;.</p>",
    );
  });
  it("uses profession-led profile wording and an editable homepage sharing title", () => {
    const { doc } = fixture();
    doc.profile.headline = "Physician and researcher";
    doc.profile.affiliation = "Hidden University";
    doc.profile.showAffiliation = false;
    doc.seo.title = "My professional website";
    const pages = renderPortfolio(doc, options);
    expect(pages["index.html"]).toContain(
      'property="og:title" content="My professional website"',
    );
    expect(pages["index.html"]).not.toContain("Hidden University");
    expect(pages["contact/index.html"]).not.toContain("Hidden University");
  });
  it("supports 250 editable articles with bounded archive cards and individual share metadata", () => {
    const { doc, article } = fixture();
    doc.sections[0].entries = Array.from({ length: 250 }, (_, index) => ({
      ...article,
      id: crypto.randomUUID(),
      title: `Article ${index}`,
      body: "Evidence. ".repeat(1000),
      tags: "Relapse, MYC",
    }));
    doc.navigation.archivePageSize = 12;
    doc.navigation.trendingTopics = ["MYC", "Relapse"];
    doc.sections[0].entries[249].coverId = crypto.randomUUID();
    expect(documentSchema.safeParse(doc).success).toBe(true);
    const pages = renderPortfolio(doc, options);
    const archive = pages["article/index.html"];
    expect(
      (
        archive
          .split("<template data-archive-rest>")[0]
          .match(/class="card archive-card"/g) || []
      ).length,
    ).toBe(12);
    expect(archive).toContain('data-topic="MYC"');
    expect(archive).not.toContain("Evidence. ".repeat(100));
    const last = doc.sections[0].entries[249];
    expect(pages[`article/${last.id}/index.html`]).toContain(
      `property="og:image" content="${options.asset(last.coverId!)}"`,
    );
    expect(pages[`article/${last.id}/index.html`]).toContain(
      'name="twitter:card" content="summary_large_image"',
    );
    expect(pages[`article/${last.id}/index.html`]).toContain(
      'property="og:type" content="article"',
    );
  });
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
  it("supports unambiguous citation names, exact overrides and complete RIS metadata", () => {
    const { article } = fixture();
    article.authors = "van der Waals, Johannes Diderik";
    article.authorFormat = "family-given";
    expect(articleCitation(article, options.baseUrl, "APA")).toContain(
      "van der Waals, J. D.",
    );
    expect(articleCitation(article, options.baseUrl, "Vancouver")).toContain(
      "van der Waals JD.",
    );
    expect(articleCitation(article, options.baseUrl, "RIS")).toContain(
      "VL  - 2\nIS  - 3\nSP  - 10\nEP  - 20",
    );
    article.citationOverrides = { APA: "Publisher-approved citation <exact>" };
    expect(articleCitation(article, options.baseUrl, "APA")).toBe(
      "Publisher-approved citation <exact>",
    );
    expect(articleCitation(article, options.baseUrl, "IEEE")).toContain(
      "vol. 2, no. 3, pp. 10–20",
    );
  });
  it("round-trips article controls, escapes overrides and honors each display setting", () => {
    const { doc, article } = fixture();
    article.authorDetails = {
      name: "Guest Writer",
      affiliation: "Guest University",
      bio: "Custom author biography",
    };
    article.citationOverrides = { APA: "<script>unsafe()</script>" };
    doc.sections[0].intro = "Editable archive introduction";
    doc.navigation.archivePageSize = 7;
    doc.navigation.archiveSort = "title";
    const saved = documentSchema.parse(doc);
    let pages = renderPortfolio(saved, options);
    let page = pages[`article/${article.id}/index.html`];
    expect(page).toContain("Guest Writer");
    expect(page).toContain("Custom author biography");
    expect(page).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(pages["article/index.html"]).toContain(
      'data-page-size="7" data-sort="title"',
    );
    expect(pages["article/index.html"]).toContain(
      "Editable archive introduction",
    );
    article.display = {
      abstract: false,
      fullText: false,
      images: false,
      author: false,
      citations: false,
      related: false,
    };
    page = renderPortfolio(doc, options)[`article/${article.id}/index.html`];
    expect(page).not.toContain('class="abstract article-text"');
    expect(page).not.toContain("Methods and findings.");
    expect(page).not.toContain('class="author-card"');
    expect(page).not.toContain('class="citations" data-citations');
    expect(page).toContain("Download as PDF");
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
