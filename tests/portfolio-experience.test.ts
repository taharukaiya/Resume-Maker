import { describe, expect, it } from "vitest";
import { signatureLooks } from "../src/modules/portfolios/design";
import {
  canEditDocument,
  documentSchema,
  emptyDocument,
  emptyEntry,
} from "../src/modules/portfolios/schema";
import { renderPortfolio } from "../src/modules/publishing/render";

const options = {
  baseUrl: "https://research.example",
  agencyName: "Brilliancy Research",
  asset: () => "",
  siteId: crypto.randomUUID(),
  appUrl: "https://studio.example",
};

describe("Portfolio experience", () => {
  it("keeps legacy documents editable without adding locked fields", () => {
    const legacy = emptyDocument("Researcher");
    delete legacy.theme.motion;
    delete legacy.theme.researchIndex;
    delete legacy.theme.expandableEntries;
    delete legacy.theme.stickyNavigation;
    for (const key of [
      "readMore",
      "showLess",
      "explore",
      "researchIndex",
      "backToTop",
    ] as const)
      delete legacy.labels[key];
    const edited = documentSchema.parse({
      ...legacy,
      profile: { ...legacy.profile, bio: "Updated biography" },
    });
    expect(canEditDocument(legacy, edited, ["profile.bio"])).toBe(true);
    expect(edited.theme).not.toHaveProperty("motion");
    expect(edited.labels).not.toHaveProperty("readMore");
    expect(renderPortfolio(legacy, options)["index.html"]).toContain(
      'data-motion="none"',
    );
  });

  it.each(signatureLooks)(
    "renders $name with valid colors and no executable scripts",
    (look) => {
      const doc = emptyDocument("Researcher <script>unsafe()</script>");
      doc.theme = { ...doc.theme, ...look.theme };
      doc.sections = [
        {
          id: crypto.randomUUID(),
          type: "projects",
          title: "Selected research",
          intro: "",
          visible: true,
          entries: [
            {
              ...emptyEntry(),
              title: "Research",
              body: "Evidence & interpretation. ".repeat(40),
            },
          ],
        },
      ];
      const hidden = {
        ...doc.sections[0],
        id: crypto.randomUUID(),
        title: "Private draft section",
        visible: false,
        entries: [],
      };
      doc.sections.push(hidden);
      doc.pages = [
        {
          id: crypto.randomUUID(),
          title: "Teaching",
          slug: "teaching",
          description: "",
          sections: [],
        },
      ];
      const pages = renderPortfolio(documentSchema.parse(doc), options);
      const html = pages["index.html"];
      expect(html).toContain(`class="${look.theme.style}"`);
      expect(html).toContain('class="research-index"');
      expect(html).toContain('class="entry-details"');
      expect(html).toContain("Evidence &amp; interpretation.");
      expect(html).not.toContain("Private draft section");
      expect(html).not.toContain("<script>unsafe()");
      expect(html.match(/<script\b/g)).toHaveLength(1);
      expect(html).toContain('<script type="application/ld+json">');
      expect(pages["teaching/index.html"]).toContain(
        "<title>Teaching — Researcher &lt;script&gt;",
      );
      doc.theme.expandableEntries = false;
      expect(renderPortfolio(doc, options)["index.html"]).not.toContain(
        '<details class="entry-details">',
      );
    },
  );

  it("does not let client field permissions change motion or interaction controls", () => {
    const original = emptyDocument("Researcher");
    const next = structuredClone(original);
    next.theme.motion = "expressive";
    expect(canEditDocument(original, next, ["profile.bio"])).toBe(false);
  });
});
