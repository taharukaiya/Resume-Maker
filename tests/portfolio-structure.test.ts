import { describe, it, expect } from "vitest";
import {
  emptyDocument as baseEmptyDocument,
  emptyEntry,
  documentSchema,
  canEditDocument,
  type Section,
} from "../src/modules/portfolios/schema";
import {
  portfolioPages,
  orderSections,
} from "../src/modules/portfolios/structure";
import { renderPortfolio } from "../src/modules/publishing/render";

const section = (type: Section["type"], title: string): Section => ({
  id: crypto.randomUUID(),
  type,
  title,
  intro: "",
  visible: true,
  entries: [],
});
const options = {
  baseUrl: "https://portfolio.example/portfolio/researcher",
  appUrl: "https://portfolio.example",
  agencyName: "Agency",
  asset: () => "",
  siteId: crypto.randomUUID(),
};
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

describe("Portfolio page structure", () => {
  it("places education before hobbies even when added later and preserves custom ordering", () => {
    const items = [
      section("custom", "Hobbies"),
      section("projects", "Projects"),
      section("education", "Education"),
    ];
    expect(orderSections(items).map((s) => s.title)).toEqual([
      "Education",
      "Projects",
      "Hobbies",
    ]);
    expect(orderSections(items, "manual")).toEqual(items);
    expect(items[0].title).toBe("Hobbies");
  });
  it("renders focused pages with active navigation, contact form, and page-specific SEO", () => {
    const doc = emptyDocument("Researcher");
    doc.profile.bio = "A biography based on research experience.";
    doc.sections = [
      section("custom", "Hobbies"),
      section("education", "Education"),
      {
        ...section("publications", "Publications"),
        entries: [
          {
            ...emptyEntry(),
            title: "A study of coastal resilience",
            body: "Evidence from field research.",
          },
        ],
      },
    ];
    const before = structuredClone(doc);
    const pages = renderPortfolio(doc, options);
    const homeBody = pages["index.html"].split('<main id="main"')[1];
    expect(homeBody).not.toContain('class="section section-education"');
    expect(
      pages["about/index.html"].indexOf("<h2>Education</h2>"),
    ).toBeLessThan(pages["about/index.html"].indexOf("<h2>Hobbies</h2>"));
    expect(pages["research/index.html"]).toContain(
      "A study of coastal resilience",
    );
    expect(pages["contact/index.html"]).toContain('class="contact-form"');
    expect(pages["contact/index.html"]).toContain(
      'href="https://portfolio.example/portfolio/researcher/contact" aria-current="page"',
    );
    expect(pages["contact/index.html"]).toContain(
      "<title>Contact | Researcher</title>",
    );
    expect(pages["contact/index.html"]).toContain(
      'name="description" content="Contact | Researcher. Contact"',
    );
    expect(pages["sitemap.xml"]).toContain("/contact</loc>");
    expect(pages["index.html"]).toContain('popovertarget="portfolio-menu"');
    expect(doc).toEqual(before);
  });
  it("honors page titles and addresses, section destinations, and existing custom pages without losing records", () => {
    const doc = emptyDocument("Researcher");
    const education = section("education", "Education");
    doc.sections = [
      education,
      { ...section("projects", "Projects"), destination: "home" },
    ];
    doc.navigation.pageSettings = {
      about: {
        title: "My background",
        slug: "background",
        description: "A personal introduction",
      },
    };
    doc.pages = [
      {
        id: crypto.randomUUID(),
        title: "My background",
        slug: "background",
        description: "More about my work",
        sections: [section("custom", "Languages")],
      },
    ];
    const plan = portfolioPages(doc);
    expect(plan.pages.filter((p) => p.slug === "background")).toHaveLength(1);
    expect(plan.pages[0].sections.map((s) => s.title)).toEqual([
      "Education",
      "Languages",
    ]);
    expect(plan.home[0].title).toBe("Projects");
    doc.navigation.layout = "single";
    expect(portfolioPages(doc).home).toHaveLength(2);
    expect(doc.sections[0].id).toBe(education.id);
  });
  it("does not repeat the home biography or expose a hidden biography in the hero", () => {
    const doc = emptyDocument("Researcher");
    doc.profile.bio = "Research biography that can be hidden.";
    doc.sections = [section("about", "About")];
    const home = () => renderPortfolio(doc, options)["index.html"];
    expect(home()).toContain('class="hero-bio"');
    doc.navigation.layout = "single";
    expect(home()).not.toContain('class="hero-bio"');
    doc.navigation.layout = "pages";
    doc.sections[0].destination = "home";
    expect(home()).not.toContain('class="hero-bio"');
    doc.sections[0].visible = false;
    expect(home()).not.toContain(doc.profile.bio);
  });
  it("does not add duplicate profile sections when custom pages already contain them", () => {
    const doc = emptyDocument("Researcher");
    doc.profile.bio = "A research biography.";
    doc.pages = ["about", "contact"].map((type) => ({
      id: crypto.randomUUID(),
      slug: type,
      title: type,
      description: "",
      sections: [section(type as "about" | "contact", type)],
    }));
    const plan = portfolioPages(doc);
    expect(plan.pages.map((page) => page.sections.length)).toEqual([1, 1]);
    doc.pages[1].sections[0].visible = false;
    expect(renderPortfolio(doc, options)["contact/index.html"]).not.toContain(
      'class="contact-form"',
    );
  });
  it("rejects colliding page addresses and prevents clients changing page placement", () => {
    const doc = emptyDocument("Researcher");
    doc.navigation.pageSettings = {
      research: { title: "Research", slug: "about", description: "" },
    };
    expect(documentSchema.safeParse(doc).success).toBe(false);
    delete doc.navigation.pageSettings;
    doc.sections = [section("education", "Education")];
    const changed = structuredClone(doc);
    changed.sections[0].destination = "home";
    expect(canEditDocument(doc, changed, ["sections.education"])).toBe(false);
  });
});
