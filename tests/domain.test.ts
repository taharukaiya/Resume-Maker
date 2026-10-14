import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  emptyDocument as baseEmptyDocument,
  emptyEntry,
  documentSchema,
  canEditDocument,
} from "../src/modules/portfolios/schema";
import {
  renderPortfolio,
  escapeHtml,
  formatDate,
} from "../src/modules/publishing/render";
// Preserve compatibility with older saved designs.
const emptyDocument = (name: string) => {
  const doc = baseEmptyDocument(name);
  doc.theme = {
    ...doc.theme,
    style: "modern",
    font: "manrope",
    bodyFont: "dm-sans",
  };
  return doc;
};

describe("Client field permissions", () => {
  const original = emptyDocument("A researcher");
  it("accepts a change to an explicitly unlocked field", () => {
    const next = structuredClone(original);
    next.profile.bio = "Updated biography";
    expect(canEditDocument(original, next, ["profile.bio"])).toBe(true);
  });
  it("rejects changes hidden alongside an allowed change", () => {
    const next = structuredClone(original);
    next.profile.bio = "Updated biography";
    next.theme.accent = "#ffffff";
    expect(canEditDocument(original, next, ["profile.bio"])).toBe(false);
  });
  it("rejects adding a section even with section access", () => {
    const next = structuredClone(original);
    next.sections.push({
      id: randomUUID(),
      type: "education",
      title: "Education",
      visible: true,
      intro: "",
      entries: [],
    });
    expect(canEditDocument(original, next, ["sections.education"])).toBe(false);
  });
  it("permits edits to existing allowed sections but not reordering", () => {
    const base = structuredClone(original);
    base.sections = [
      {
        id: randomUUID(),
        type: "education",
        title: "Education",
        visible: true,
        intro: "",
        entries: [],
      },
      {
        id: randomUUID(),
        type: "projects",
        title: "Projects",
        visible: true,
        intro: "",
        entries: [],
      },
    ];
    const next = structuredClone(base);
    next.sections[0].entries = [emptyEntry()];
    expect(canEditDocument(base, next, ["sections.education"])).toBe(true);
    next.sections.reverse();
    expect(canEditDocument(base, next, ["sections.education"])).toBe(false);
  });
});
describe("Content validation and HTML safety", () => {
  it("rejects script URLs", () => {
    const doc = emptyDocument("Name");
    doc.profile.links = [{ label: "Unsafe", url: "javascript:alert(1)" }];
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it("rejects CSS injection", () => {
    const doc = emptyDocument("Name");
    doc.theme.accent = "red;display:none";
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it("rejects unrecognized properties rather than trusting client input", () => {
    expect(
      documentSchema.safeParse({ ...emptyDocument("Name"), isAdmin: true })
        .success,
    ).toBe(false);
  });
  it("rejects duplicate page addresses", () => {
    const doc = emptyDocument("Name");
    doc.pages = [
      {
        id: randomUUID(),
        title: "A",
        slug: "work",
        description: "",
        sections: [],
      },
      {
        id: randomUUID(),
        title: "B",
        slug: "work",
        description: "",
        sections: [],
      },
    ];
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it("escapes HTML and quote characters", () => {
    expect(escapeHtml('<img onerror="x">')).toBe(
      "&lt;img onerror=&quot;x&quot;&gt;",
    );
  });
  it("generates readable HTML, publication pages, canonical metadata, and sitemap", () => {
    const doc = emptyDocument("Researcher <script>alert(1)</script>");
    doc.profile.bio = "A biography.";
    doc.sections = [
      {
        id: randomUUID(),
        type: "publications",
        title: "Publications",
        visible: true,
        intro: "",
        entries: [
          {
            ...emptyEntry(),
            title: "An academic paper",
            body: "Measured results and conclusions.",
            start: "2025",
            authors: "A. Researcher",
            abstractSource: "original",
          },
        ],
      },
    ];
    const entryId = doc.sections[0].entries[0].id,
      pages = renderPortfolio(doc, {
        baseUrl: "https://portfolio.example",
        agencyName: "Brilliancy Research",
        asset: () => "",
        siteId: randomUUID(),
        appUrl: "https://studio.example",
      });
    expect(pages["index.html"]).not.toContain("<script>alert(1)</script>");
    expect(pages["index.html"]).toContain("Researcher &lt;script&gt;");
    expect(pages[`publications/${entryId}/index.html`]).toContain(
      "ScholarlyArticle",
    );
    expect(pages["sitemap.xml"]).toContain(
      `https://portfolio.example/publications/${entryId}`,
    );
    expect(pages["index.html"]).toContain('rel="canonical"');
  });
  it("preserves date precision", () => {
    expect(formatDate("2024")).toBe("2024");
    expect(formatDate("2024-05")).toMatch(/May.*2024/);
    expect(formatDate("")).toBe("");
  });
  it("rejects impossible dates and unreadable theme colors", () => {
    const doc = emptyDocument("Name");
    doc.sections = [
      {
        id: randomUUID(),
        type: "education",
        title: "Education",
        visible: true,
        intro: "",
        entries: [{ ...emptyEntry(), start: "2025-02-30" }],
      },
    ];
    expect(documentSchema.safeParse(doc).success).toBe(false);
    doc.sections = [];
    doc.theme.accent = doc.theme.background;
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
});
