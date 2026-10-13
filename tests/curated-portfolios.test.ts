import { describe, expect, it } from "vitest";
import {
  emptyDocument,
  emptyEntry,
  publicationIssues,
} from "../src/modules/portfolios/schema";
import { portfolioSeo } from "../src/modules/portfolios/seo";
import { renderPortfolio } from "../src/modules/publishing/render";
import { signatureLooks } from "../src/modules/portfolios/design";
import { replacePublications } from "../src/components/publications-editor";

describe("Curated portfolio workflow", () => {
  it("derives current metadata without leaking hidden biography and preserves explicit overrides", () => {
    const doc = emptyDocument("Amina Rahman");
    doc.profile.headline = "Climate researcher";
    doc.profile.bio = "Private biography";
    expect(portfolioSeo(doc).title).toBe("Amina Rahman — Climate researcher");
    expect(portfolioSeo(doc).description).not.toContain("Private biography");
    doc.profile.name = "Amina Hasan";
    expect(portfolioSeo(doc).title).toContain("Amina Hasan");
    doc.seo.title = "My research";
    doc.seo.description = "Custom introduction";
    doc.profile.portraitId = crypto.randomUUID();
    expect(portfolioSeo(doc)).toEqual({
      title: "My research",
      description: "Custom introduction",
      socialImageId: doc.profile.portraitId,
    });
  });
  it("requires public education with institution and dates, while allowing ongoing studies", () => {
    const doc = emptyDocument("Researcher");
    expect(publicationIssues(doc)).toContain(
      "Academic sections: add at least one visible education entry.",
    );
    const section = {
      id: crypto.randomUUID(),
      type: "education" as const,
      title: "Education",
      visible: true,
      intro: "",
      entries: [
        {
          ...emptyEntry(),
          title: "BSc",
          subtitle: "University",
          start: "2020",
          current: true,
        },
      ],
    };
    doc.pages = [
      {
        id: crypto.randomUUID(),
        title: "Background",
        slug: "background",
        description: "",
        sections: [section],
      },
    ];
    expect(publicationIssues(doc)).toEqual([]);
    section.entries[0].current = false;
    section.entries[0].end = "2019";
    expect(publicationIssues(doc).join(" ")).toContain("must not precede");
    section.entries[0].end = "2024";
    expect(publicationIssues(doc)).toEqual([]);
    section.visible = false;
    expect(publicationIssues(doc).length).toBeGreaterThan(0);
  });
  it("edits publications without replacing unrelated sections", () => {
    const base = {
      id: crypto.randomUUID(),
      type: "education" as const,
      title: "Education",
      visible: true,
      intro: "",
      entries: [],
    };
    const publication = {
      ...base,
      id: crypto.randomUUID(),
      type: "publications" as const,
      title: "Publications",
    };
    const updated = { ...publication, title: "Papers" };
    expect(replacePublications([base, publication], [updated])).toEqual([
      base,
      updated,
    ]);
    expect(replacePublications([base, publication], [])).toEqual([base]);
  });
  it("offers six script-free designs with metadata, canonical URLs and motion safeguards", () => {
    expect(signatureLooks).toHaveLength(6);
    for (const look of signatureLooks) {
      const doc = emptyDocument("Researcher");
      doc.theme = { ...doc.theme, ...look.theme };
      const html = renderPortfolio(doc, {
        baseUrl: "https://researchbyamina.com",
        agencyName: "Brilliancy",
        asset: () => "",
        siteId: crypto.randomUUID(),
        appUrl: "https://studio.example",
      })["index.html"];
      expect(html).toContain('class="ambient-shapes" aria-hidden="true"');
      expect(html).toContain("prefers-reduced-motion:reduce");
      expect(html).toContain(
        '<link rel="canonical" href="https://researchbyamina.com">',
      );
      expect(html.match(/<script/g)).toHaveLength(1); // Structured data only.
      expect(html).not.toContain('class="research-index"');
    }
  });
});
