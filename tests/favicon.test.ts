import { describe, it, expect } from "vitest";
import {
  initialsFavicon,
  nameInitials,
} from "../src/modules/publishing/favicon";
import { renderPortfolio } from "../src/modules/publishing/render";
import { emptyDocument, emptyEntry } from "../src/modules/portfolios/schema";
import { signatureLooks } from "../src/modules/portfolios/design";

describe("Researcher favicons", () => {
  it("keeps every design person-first, with current titles and photo icons across pages", () => {
    const doc = emptyDocument("Amina Rahman");
    doc.profile.headline = "Climate researcher";
    doc.profile.affiliation = "Example University";
    doc.seo.title = "Old custom search title";
    const paper = { ...emptyEntry(), title: "Climate & communities" };
    doc.sections = [
      {
        id: crypto.randomUUID(),
        type: "publications",
        title: "Publications",
        visible: true,
        intro: "",
        entries: [paper],
      },
    ];
    doc.pages = [
      {
        id: crypto.randomUUID(),
        title: "Contact",
        slug: "contact-me",
        description: "",
        sections: [],
      },
    ];
    const options = {
      baseUrl: "https://example.org",
      agencyName: "Agency",
      siteId: crypto.randomUUID(),
      asset: (id: string) => `https://example.org/${id}.webp`,
      appUrl: "https://studio.example.org",
    };
    for (const look of signatureLooks) {
      doc.theme = { ...doc.theme, ...look.theme };
      const pages = renderPortfolio(doc, options);
      expect(pages["index.html"]).toContain(
        '<div class="hero-copy"><h1>Amina Rahman</h1>',
      );
      expect(pages["index.html"]).toContain(
        '<p class="meta hero-affiliation">Example University</p>',
      );
      expect(pages["index.html"]).not.toContain(
        '<p class="eyebrow">Example University</p>',
      );
      expect(pages["index.html"]).toContain(
        "<title>Amina Rahman — Climate researcher</title>",
      );
      expect(pages["index.html"]).toContain(
        'property="og:title" content="Old custom search title"',
      );
      expect(pages["contact-me/index.html"]).toContain(
        "<title>Contact — Amina Rahman</title>",
      );
      expect(pages[`publications/${paper.id}/index.html`]).toContain(
        "<title>Climate &amp; communities — Amina Rahman</title>",
      );
    }
    doc.profile.name = "Amina Hasan";
    doc.profile.portraitId = crypto.randomUUID();
    const changed = renderPortfolio(doc, options);
    expect(changed["index.html"]).toContain(
      "<title>Amina Hasan — Climate researcher</title>",
    );
    expect(changed["contact-me/index.html"]).toContain(
      "<title>Contact — Amina Hasan</title>",
    );
    for (const [route, html] of Object.entries(changed))
      if (route.endsWith(".html")) {
        expect(html).toContain(
          `rel="icon" type="image/webp" href="${options.asset(doc.profile.portraitId)}"`,
        );
      }
    doc.profile.portraitId = "";
    doc.profile.affiliation = "";
    const withoutPhoto = renderPortfolio(doc, options);
    expect(withoutPhoto["favicon.svg"]).toContain(">AH</text>");
    expect(withoutPhoto["index.html"]).toContain(
      'rel="icon" type="image/svg+xml"',
    );
    expect(withoutPhoto["index.html"]).not.toContain(
      'class="meta hero-affiliation"',
    );
  });
  it("uses first and last name, handles single names and escapes SVG markup", () => {
    expect(nameInitials(" Dr. Amina Noor Rahman ")).toBe("AR");
    expect(nameInitials("Tresna")).toBe("T");
    expect(initialsFavicon("<svg malicious>", "#112233")).not.toContain("<m");
    expect(initialsFavicon("<svg malicious>", "#112233")).toContain("&lt;M");
    expect(initialsFavicon("A B", 'red" onload="alert(1)')).not.toContain(
      "onload",
    );
  });
  it("adds a personal favicon to all pages without indexing the icon", () => {
    const doc = emptyDocument("Dr. Amina Rahman");
    doc.pages = [
      {
        id: crypto.randomUUID(),
        title: "Contact",
        slug: "contact",
        description: "",
        sections: [],
      },
    ];
    const options = {
      baseUrl: "https://researchbyamina.com",
      agencyName: "Agency",
      siteId: crypto.randomUUID(),
      asset: (id: string) => `https://assets.example/${id}.webp`,
      appUrl: "https://studio.example",
    };
    const pages = renderPortfolio(doc, options);
    for (const [route, html] of Object.entries(pages))
      if (route.endsWith(".html")) {
        expect(html).toContain('rel="icon" type="image/svg+xml"');
        expect(html).toContain("https://researchbyamina.com/favicon.svg?v=");
      }
    expect(pages["favicon.svg"]).toContain(">AR</text>");
    expect(pages["sitemap.xml"]).not.toContain("favicon");
    doc.profile.portraitId = crypto.randomUUID();
    expect(renderPortfolio(doc, options)["index.html"]).toContain(
      `href="${options.asset(doc.profile.portraitId)}"`,
    );
    expect(
      renderPortfolio(doc, {
        ...options,
        faviconUrl: "https://researchbyamina.com/favicon.png?v=release",
      })["index.html"],
    ).toContain(
      'rel="icon" type="image/png" href="https://researchbyamina.com/favicon.png?v=release"',
    );
  });
});
