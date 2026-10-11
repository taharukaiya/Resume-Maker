import { describe, expect, it } from "vitest";
import {
  applyCvImport,
  type CvExtraction,
} from "../src/modules/portfolios/cv-import";
import {
  documentSchema,
  emptyDocument,
} from "../src/modules/portfolios/schema";
import {
  palettes,
  styles,
  selectedFonts,
} from "../src/modules/portfolios/design";
import { renderPortfolio } from "../src/modules/publishing/render";

const extracted: CvExtraction = {
  profile: {
    name: "Extracted name",
    headline: "Researcher",
    affiliation: "University",
    bio: "CV biography",
    location: "Dhaka",
    email: "researcher@example.org",
    links: [{ label: "Research", url: "https://example.org" }],
  },
  sections: [
    {
      type: "education",
      title: "Education",
      entries: [
        {
          title: "MSc",
          subtitle: "University",
          body: "Research degree",
          start: "2020",
          end: "2022-06",
          current: false,
          url: "",
          tags: "",
          authors: "",
          doi: "",
          status: "",
        },
      ],
    },
  ],
  warnings: [],
};
describe("CV review and merge", () => {
  it("applies valid selected facts while preserving unfinished pages and unrelated edits", () => {
    const original = emptyDocument("Existing name");
    original.pages = [
      {
        id: crypto.randomUUID(),
        title: "",
        slug: "",
        description: "Work in progress",
        sections: [],
      },
    ];
    original.theme.style = "noir";
    const result = applyCvImport(original, extracted, {
      profile: ["name"],
      entries: ["0:0"],
      links: true,
      replace: true,
    });
    expect(result.profile.name).toBe("Extracted name");
    expect(result.sections[0].entries[0].title).toBe("MSc");
    expect(result.profile.links).toEqual(extracted.profile.links);
    expect(result.pages).toEqual(original.pages);
    expect(result.theme.style).toBe("noir");
    expect(original.profile.name).toBe("Existing name");
    expect(original.sections).toEqual([]);
    expect(documentSchema.safeParse(result).success).toBe(false);
  });
  it("preserves existing fields and content, applies only chosen facts, and never attaches the CV publicly", () => {
    const original = emptyDocument("Existing name");
    const result = applyCvImport(original, extracted, {
      profile: ["name", "headline"],
      entries: ["0:0"],
      links: false,
      replace: false,
    });
    expect(result.profile.name).toBe("Existing name");
    expect(result.profile.headline).toBe("Researcher");
    expect(result.profile.email).toBe("");
    expect(result.profile.cvId).toBe("");
    expect(result.profile.links).toHaveLength(0);
    expect(result.sections[0].entries[0].start).toBe("2020");
    expect(original.sections).toHaveLength(0);
  });
  it("replaces selected profile fields only when opted in, and deduplicates repeated imports", () => {
    const choices = {
      profile: ["name"],
      entries: ["0:0"],
      links: true,
      replace: true,
    };
    const once = applyCvImport(emptyDocument("Old"), extracted, choices);
    const twice = applyCvImport(once, extracted, choices);
    expect(twice.profile.name).toBe("Extracted name");
    expect(twice.sections).toHaveLength(1);
    expect(twice.sections[0].entries).toHaveLength(1);
    expect(twice.profile.links).toHaveLength(1);
  });
  it("rejects unsafe links and impossible dates before they enter a draft", () => {
    const bad = structuredClone(extracted);
    bad.profile.links[0].url = "javascript:alert(1)";
    expect(() =>
      applyCvImport(emptyDocument("Old"), bad, {
        profile: [],
        entries: [],
        links: true,
        replace: false,
      }),
    ).toThrow();
    bad.sections[0].entries[0].start = "2023-02-30";
    expect(() =>
      applyCvImport(emptyDocument("Old"), bad, {
        profile: [],
        entries: ["0:0"],
        links: false,
        replace: false,
      }),
    ).toThrow();
  });
});
describe("Portfolio designs", () => {
  it("accepts legacy themes and every curated palette with readable text", () => {
    const doc = emptyDocument("Researcher");
    expect(documentSchema.safeParse(doc).success).toBe(true);
    for (const palette of palettes)
      expect(
        documentSchema.safeParse({
          ...doc,
          theme: {
            ...doc.theme,
            ...Object.fromEntries(
              Object.entries(palette).filter(([k]) => k !== "name"),
            ),
          },
        }).success,
        palette.name,
      ).toBe(true);
  });
  it("renders every composition with independent local typography and no executable scripts", () => {
    for (const style of styles) {
      const doc = emptyDocument("<Researcher>");
      doc.theme = {
        ...doc.theme,
        style: style.id,
        font: "fraunces",
        bodyFont: "dm-sans",
      };
      const html = renderPortfolio(doc, {
        baseUrl: "https://example.org",
        agencyName: "Agency",
        siteId: crypto.randomUUID(),
        asset: () => "",
        appUrl: "https://admin.example.org",
      })["index.html"];
      expect(html).toContain(`class="${style.id}"`);
      expect(html).toContain("https://example.org/fonts/fraunces.woff2");
      expect(html).toContain("https://example.org/fonts/dm-sans.woff2");
      expect(html).toContain("&lt;Researcher&gt;");
      expect(html).not.toContain("<script src=");
      expect(html).not.toContain("fonts.googleapis");
    }
    expect(selectedFonts({ font: "manrope", bodyFont: "manrope" })).toEqual([
      "manrope",
    ]);
    expect(selectedFonts({ font: "serif" })).toEqual([]);
  });
});
