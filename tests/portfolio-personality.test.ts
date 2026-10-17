import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  emptyDocument,
  emptyEntry,
  canEditDocument,
} from "../src/modules/portfolios/schema";
import { renderPortfolio } from "../src/modules/publishing/render";
import { shibaDocument } from "../src/modules/publishing/shiba";
import { socialCard } from "../src/modules/publishing/social-card";
const options = {
  baseUrl: "https://portfolio.test",
  appUrl: "https://studio.test",
  siteId: crypto.randomUUID(),
  agencyName: "Agency",
  asset: (id: string) => `https://portfolio.test/assets/${id}`,
  socialImage: () => "https://portfolio.test/social.jpg?v=release",
};
describe("personal portfolio presentation", () => {
  it("renders editable quotes and cards safely across pages and respects client permissions", () => {
    const before = emptyDocument("Test person"),
      doc = structuredClone(before);
    doc.profile.contactQuote = "Curiosity <script> is a beginning.";
    doc.profile.featureCards = [
      {
        title: "Research",
        body: "Evidence and analysis",
        icon: "research",
        url: "https://example.com",
        linkLabel: "Explore",
      },
    ];
    expect(canEditDocument(before, doc, [])).toBe(false);
    expect(
      canEditDocument(before, doc, [
        "profile.contactQuote",
        "profile.featureCards",
      ]),
    ).toBe(true);
    doc.sections = [
      {
        id: crypto.randomUUID(),
        type: "about",
        title: "About",
        intro: "",
        visible: true,
        entries: [],
      },
      {
        id: crypto.randomUUID(),
        type: "contact",
        title: "Contact",
        intro: "",
        visible: true,
        entries: [],
      },
    ];
    const pages = renderPortfolio(shibaDocument(doc), options);
    for (const path of [
      "index.html",
      "about/index.html",
      "contact/index.html",
    ]) {
      expect(pages[path]).toContain('class="personality-card"');
      expect(pages[path]).toContain('class="personality-quote"');
      expect(pages[path]).toContain("Curiosity &lt;script&gt;");
      expect(pages[path]).toContain('og:image:type" content="image/jpeg"');
      expect(pages[path]).toContain('og:image:width" content="1200"');
    }
  });
  it("retains customized contact labels and uses real category counts", () => {
    const doc = emptyDocument("Person");
    doc.navigation.contactLabel = "Get in touch";
    expect(shibaDocument(doc).navigation.contactLabel).toBe("Contact");
    doc.navigation.contactLabelCustomized = true;
    expect(shibaDocument(doc).navigation.contactLabel).toBe("Get in touch");
    doc.sections = [
      {
        id: crypto.randomUUID(),
        type: "publications",
        title: "Research",
        intro: "",
        visible: true,
        entries: [
          { ...emptyEntry(), title: "First", category: "Policy" },
          { ...emptyEntry(), title: "Second", category: "Policy" },
        ],
      },
    ];
    const html = renderPortfolio(shibaDocument(doc), options)[
      "research/index.html"
    ];
    expect(html).toContain(
      'data-category="Policy" aria-pressed="false">Policy <span>2</span>',
    );
  });
  it("creates JPEG sharing images at social-card dimensions, even without a portrait", async () => {
    const doc = emptyDocument("Rukaiya Taha");
    doc.profile.headline = "Software Engineer";
    const image = await socialCard(doc);
    expect(await sharp(image).metadata()).toMatchObject({
      format: "jpeg",
      width: 1200,
      height: 630,
    });
    const custom = await socialCard(
      doc,
      await sharp({
        create: { width: 80, height: 120, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer(),
      true,
    );
    expect(await sharp(custom).metadata()).toMatchObject({
      format: "jpeg",
      width: 1200,
      height: 630,
    });
  });
});
