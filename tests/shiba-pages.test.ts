import { socialIcon, homeIcon } from "../src/modules/publishing/shiba-home";
import { describe, expect, it } from "vitest";
import {
  emptyDocument,
  emptyEntry,
  documentSchema,
  type Section,
} from "../src/modules/portfolios/schema";
import { renderPortfolio } from "../src/modules/publishing/render";
import { portfolioTabTitle } from "../src/modules/portfolios/seo";
const options = {
  baseUrl: "https://portfolio.test",
  appUrl: "https://studio.test",
  agencyName: "Agency",
  siteId: crypto.randomUUID(),
  asset: (id: string) => `https://portfolio.test/assets/${id}.webp`,
};
const section = (
  type: Section["type"],
  title: string,
  entries: Section["entries"] = [],
): Section => ({
  id: crypto.randomUUID(),
  type,
  title,
  visible: true,
  intro: "",
  entries,
});
function fixture() {
  const doc = emptyDocument("Amina Rahman");
  doc.profile.headline = "Research & evidence";
  doc.profile.aboutHeadline = "An editable About heading";
  doc.profile.aboutBio = "First biography paragraph.\n\nSecond paragraph.";
  doc.profile.portraitId = crypto.randomUUID();
  doc.profile.logoId = crypto.randomUUID();
  doc.profile.officeHours = "Tuesday | 10am";
  doc.profile.mailingAddress = "Test University";
  doc.sections = [
    section("about", "About Me"),
    section("education", "Education", [
      {
        ...emptyEntry(),
        title: "PhD",
        subtitle: "Example University",
        start: "2020",
        end: "2024",
      },
    ]),
    section("experience", "Experience", [
      {
        ...emptyEntry(),
        title: "Research Fellow",
        start: "2024",
        current: true,
      },
    ]),
    section("interests", "Research Interests", [
      {
        ...emptyEntry(),
        title: "Climate research",
        body: "Evidence and resilience.",
      },
    ]),
    section("conferences", "Conference Participated", [
      { ...emptyEntry(), title: "Test conference", start: "2025" },
    ]),
    section("awards", "Honors & Awards", [
      { ...emptyEntry(), title: "Test award", start: "2024" },
    ]),
    section("contact", "Contact", [
      {
        ...emptyEntry(),
        title: "Collaborative research",
        body: "Work on shared questions.",
      },
    ]),
  ];
  return doc;
}
describe("Reference About and Contact layouts", () => {
  it("uses pipe browser titles and preserves authored punctuation", () => {
    const doc = fixture();
    doc.profile.headline = "Data-driven research";
    expect(portfolioTabTitle(doc)).toBe("Amina Rahman | Data-driven research");
    expect(portfolioTabTitle(doc, "About Me")).toBe("About Me | Amina Rahman");
  });
  it("renders the framed portrait, two academic columns and optional About sections", () => {
    const doc = fixture();
    const pages = renderPortfolio(doc, options);
    const html = pages["about/index.html"];
    expect(html).toContain('class="about-photo"');
    expect(html).toContain('class="about-history"');
    for (const text of [
      "An editable About heading",
      "Second paragraph.",
      "Example University",
      "Research Fellow",
      "Climate research",
      "Test conference",
      "Test award",
    ])
      expect(html).toContain(text);
    expect(pages["index.html"]).toContain(options.asset(doc.profile.logoId!));
    doc.sections.find((s) => s.type === "education")!.visible = false;
    expect(renderPortfolio(doc, options)["about/index.html"]).not.toContain(
      "Example University",
    );
    doc.sections.find((s) => s.type === "about")!.visible = false;
    expect(renderPortfolio(doc, options)["about/index.html"]).toBeUndefined();
  });
  it("keeps custom page content and configured addresses inside the fixed layouts", () => {
    const doc = fixture();
    doc.navigation.layout = "pages";
    doc.navigation.pageSettings = {
      about: { title: "Biography", slug: "biography", description: "" },
      research: { title: "Research", slug: "work", description: "" },
      contact: { title: "Get in touch", slug: "connect", description: "" },
    };
    doc.pages = [
      {
        id: crypto.randomUUID(),
        slug: "biography",
        title: "Biography",
        description: "",
        sections: [
          section("custom", "Extra biography", [
            { ...emptyEntry(), title: "Additional achievement" },
          ]),
        ],
      },
    ];
    const parsed = documentSchema.parse(doc),
      pages = renderPortfolio(parsed, options);
    expect(pages["biography/index.html"]).toContain('class="about-photo"');
    expect(pages["biography/index.html"]).toContain("Additional achievement");
    expect(pages["about/index.html"]).toBe(pages["biography/index.html"]);
    expect(pages["connect/index.html"]).toContain("Quick Message");
    expect(pages["index.html"]).toContain(
      'href="https://portfolio.test/biography"',
    );
    expect(
      pages["index.html"].match(/href="https:\/\/portfolio.test\/biography"/g),
    ).toHaveLength(2);
  });
  it("provides the standard contact page while respecting an explicit hidden contact section", () => {
    const doc = fixture();
    doc.sections = doc.sections.filter((section) => section.type !== "contact");
    const pages = renderPortfolio(doc, options);
    expect(pages["contact/index.html"]).toContain("Quick Message");
    expect(pages["contact/index.html"]).toContain("Climate research");
    doc.sections.push({ ...section("contact", "Contact"), visible: false });
    expect(renderPortfolio(doc, options)["contact/index.html"]).toBeUndefined();
  });
  it("rejects conflicting fixed-page addresses even in a legacy scrolling document", () => {
    const doc = fixture();
    doc.navigation.layout = "single";
    doc.navigation.pageSettings = {
      about: { title: "About", slug: "article", description: "" },
    };
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
  it("retains the former research archive address without mixing new article content", () => {
    const doc = fixture();
    doc.sections.push(
      section("publications", "Research", [
        { ...emptyEntry(), title: "Existing paper" },
      ]),
    );
    let pages = renderPortfolio(doc, options);
    expect(pages["article/index.html"]).toBe(pages["research/index.html"]);
    doc.sections.push(
      section("articles", "Articles", [
        { ...emptyEntry(), title: "New article" },
      ]),
    );
    pages = renderPortfolio(doc, options);
    expect(pages["article/index.html"]).toContain("New article");
    expect(pages["article/index.html"]).not.toContain("Existing paper");
  });
  it("renders editable collaboration topics and real contact details safely", () => {
    const doc = fixture();
    doc.profile.contactQuote = "<script>alert(1)</script>";
    const html = renderPortfolio(doc, options)["contact/index.html"];
    expect(html).toContain('data-contact-subject="Collaborative research"');
    expect(html).toContain('name="subject"');
    expect(html).toContain("Tuesday | 10am");
    expect(html).toContain("Test University");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
  it("round-trips independent home copy, link controls and safe footer URLs", () => {
    const doc = fixture();
    doc.profile.heroBadge = "CLIMATE | POLICY";
    doc.profile.heroHeadline = "Evidence for a better future";
    doc.profile.headlineHighlight = "better future";
    doc.profile.heroIntro = "<script>unsafe()</script>\n\nEdited introduction.";
    doc.profile.links = [
      {
        label: "Read my work",
        url: "https://example.com/work",
        icon: "scholar",
        showInHero: true,
      },
      {
        label: "Contact-only link",
        url: "https://example.com/contact",
        showInHero: false,
      },
    ];
    doc.navigation.footerLinks = [
      { label: "Privacy policy", url: "https://example.com/privacy" },
    ];
    doc.labels.pipelineHeading = "Current manuscripts";
    const parsed = documentSchema.parse(doc),
      pages = renderPortfolio(parsed, options);
    const hero = pages["index.html"]
      .split('<section class="hero">')[1]
      .split("</section>")[0];
    expect(hero).toContain("Evidence for a <span>better future</span>");
    expect(hero).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
    expect(hero).toContain("Read my work");
    expect(hero).not.toContain("Contact-only link");
    expect(pages["contact/index.html"]).toContain("Contact-only link");
    expect(pages["about/index.html"]).toContain("An editable About heading");
    expect(pages["index.html"]).toContain('href="https://example.com/privacy"');
    doc.navigation.footerLinks[0].url = "javascript:alert(1)";
    expect(documentSchema.safeParse(doc).success).toBe(false);
    doc.profile.portraitPositionX = 101;
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
});

it("distinguishes hosted websites from GitHub profiles and honors admin icon choices", () => {
  expect(
    socialIcon({
      label: "Personal Website",
      url: "https://taharukaiya.github.io/",
    }),
  ).toBe(homeIcon("website"));
  expect(
    socialIcon({ label: "GitHub", url: "https://github.com/taharukaiya" }),
  ).toBe(homeIcon("github"));
  expect(
    socialIcon({ label: "Website", url: "https://example.com", icon: "orcid" }),
  ).toBe(homeIcon("orcid"));
  expect(
    socialIcon({ label: "Website", url: "https://example.com", icon: "none" }),
  ).toBe("");
  const doc = emptyDocument("Amina");
  doc.profile.links = [
    { label: "Website", url: "https://example.com", icon: "website" },
  ];
  expect(documentSchema.safeParse(doc).success).toBe(true);
});
