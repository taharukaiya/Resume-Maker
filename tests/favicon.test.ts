import { describe, it, expect } from "vitest";
import {
  initialsFavicon,
  nameInitials,
} from "../src/modules/publishing/favicon";
import { renderPortfolio } from "../src/modules/publishing/render";
import { emptyDocument } from "../src/modules/portfolios/schema";

describe("Researcher favicons", () => {
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
