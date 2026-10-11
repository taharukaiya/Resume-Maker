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
      doc.navigation.layout = "single";
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
      expect(html.includes('class="research-index"')).toBe(
        !!look.theme.researchIndex,
      );
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

  it("shows public research excerpts instead of duplicate page cards and keeps the footer editable", () => {
    const doc = emptyDocument("Researcher");
    const publication = {
      ...emptyEntry(),
      title: "Coastal resilience",
      body: "Complete short abstract.",
      tags: "Climate, Communities",
    };
    doc.sections = [
      {
        id: crypto.randomUUID(),
        type: "publications",
        title: "Publications",
        intro: "",
        visible: true,
        entries: [publication],
      },
      {
        id: crypto.randomUUID(),
        type: "projects",
        title: "Private research",
        intro: "",
        visible: false,
        entries: [
          {
            ...emptyEntry(),
            title: "Unannounced project",
            tags: "Private topic",
          },
        ],
      },
    ];
    doc.navigation.copyright = "© 2024–2026 Researcher & collaborators";
    doc.labels.footerHeading = "Discuss a collaboration";
    const html = renderPortfolio(doc, options)["index.html"];
    expect(html).toContain(
      `href="https://research.example/publications/${publication.id}"`,
    );
    expect(html).toContain("Complete short abstract.");
    expect(html).toContain("Climate");
    expect(html).not.toContain("Unannounced project");
    expect(html).not.toContain("Private topic");
    expect(html).not.toContain('class="page-overview"');
    expect(html).toContain("Discuss a collaboration");
    expect(html).toContain("© 2024–2026 Researcher &amp; collaborators");
    doc.theme.homeHighlights = false;
    expect(renderPortfolio(doc, options)["index.html"]).not.toContain(
      "Coastal resilience",
    );
  });
});
