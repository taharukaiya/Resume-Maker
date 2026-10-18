import { articleFormatSchema } from "../media/article-format";
import { contrastRatio } from "@/lib/colors";
import { z } from "zod";
import { fontIds } from "./design";
const short = z.string().trim().max(200);
export const profileLinkUrlSchema = z
  .string()
  .trim()
  .transform((value) =>
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i.test(
      value,
    )
      ? `https://${value}`
      : value,
  )
  .refine((value) => {
    if (!value) return true;
    if (value.length > 2000 || /\s/.test(value)) return false;
    try {
      const parsed = new URL(value);
      return (
        /^https?:\/\//i.test(value) &&
        ["http:", "https:"].includes(parsed.protocol) &&
        !!parsed.hostname &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }, "Enter a website address such as https://example.com/profile, or leave it blank.");
const url = z.union([
  z.literal(""),
  z
    .url()
    .max(2000)
    .refine((v) => /^https?:\/\//.test(v), "Use an HTTP or HTTPS URL"),
]);
const asset = z.union([z.literal(""), z.uuid()]);
const date = z
  .string()
  .max(10)
  .refine((v) => {
    if (!v) return true;
    if (
      !/^(19|20|21)\d{2}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/.test(v)
    )
      return false;
    if (v.length < 10) return true;
    const [year, month, day] = v.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
  }, "Use a valid YYYY, YYYY-MM, or YYYY-MM-DD date");
export const sectionTypes = [
  "about",
  "education",
  "experience",
  "publications",
  "articles",
  "projects",
  "interests",
  "conferences",
  "awards",
  "skills",
  "contact",
  "custom",
] as const;
export const entrySchema = z
  .object({
    id: z.uuid(),
    title: short,
    subtitle: short,
    body: z.string().max(16000),
    start: date,
    end: date,
    current: z.boolean(),
    url,
    mediaId: asset,
    tags: z.string().max(500),
    authors: z.string().max(1000),
    doi: z.string().max(250),
    status: z.enum([
      "",
      "published",
      "accepted",
      "preprint",
      "submitted",
      "in-progress",
    ]),
    abstractSource: z.enum(["", "original", "generated"]),
    fullText: z.string().max(240000).optional(),
    formattedBody: articleFormatSchema.optional(),
    readingMinutes: z.number().int().min(1).max(999).optional(),
    category: short.optional(),
    journal: short.optional(),
    volume: z.string().max(80).optional(),
    issue: z.string().max(80).optional(),
    pages: z.string().max(80).optional(),
    coverId: asset.optional(),
    images: z
      .array(
        z
          .object({
            mediaId: z.uuid(),
            alt: z.string().max(500),
            caption: z.string().max(2000),
          })
          .strict(),
      )
      .max(24)
      .optional(),
    authorFormat: z.enum(["names", "family-given"]).optional(),
    coverAlt: z.string().max(500).optional(),
    coverCaption: z.string().max(2000).optional(),
    authorDetails: z
      .object({ name: short, affiliation: short, bio: z.string().max(16000) })
      .strict()
      .optional(),
    citationOverrides: z
      .object({
        APA: z.string().max(10000).optional(),
        IEEE: z.string().max(10000).optional(),
        Harvard: z.string().max(10000).optional(),
        MLA: z.string().max(10000).optional(),
        Chicago: z.string().max(10000).optional(),
        Vancouver: z.string().max(10000).optional(),
        BibTeX: z.string().max(10000).optional(),
        RIS: z.string().max(10000).optional(),
      })
      .strict()
      .optional(),
    display: z
      .object({
        abstract: z.boolean().optional(),
        fullText: z.boolean().optional(),
        images: z.boolean().optional(),
        author: z.boolean().optional(),
        citations: z.boolean().optional(),
        related: z.boolean().optional(),
      })
      .strict()
      .optional(),
    citationCount: z.number().int().min(0).max(1000000000).optional(),
  })
  .strict();
export const sectionSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(sectionTypes),
    title: short,
    visible: z.boolean(),
    destination: z
      .enum(["auto", "home", "about", "research", "contact"])
      .optional(),
    intro: z.string().max(10000),
    entries: z.array(entrySchema).max(1000),
  })
  .strict();
const baseLabels = {
  name: "Your name",
  email: "Email address",
  message: "Message",
  send: "Send inquiry",
  abstract: "Abstract",
  summary: "Research summary",
  summaryNote: "AI-assisted summary, reviewed before publication.",
  readPublication: "Read publication",
  downloadPaper: "Download paper",
  viewResource: "View resource",
  downloadFile: "Download file",
  ongoing: "Present",
  creditPrefix: "Portfolio by",
  skip: "Skip to content",
  receivedTitle: "Thank you for reaching out.",
  receivedMessage: "Your message has been delivered to the portfolio team.",
};
const interactionLabels = {
  searchArticles: "Search articles",
  searchPlaceholder: "Search by title, keyword, or year...",
  sortArticles: "Sort articles",
  newestFirst: "Newest First",
  oldestFirst: "Oldest First",
  titleSort: "Title A–Z",
  noResults: "No results found matching your criteria.",
  minutesRead: "min read",
  published: "Published",
  dateUnknown: "Date not specified",
  relatedResearch: "Related Research",
  relatedArticles: "Related Articles",
  tagsHeading: "Tags",
  backResearch: "Back to Research Archive",
  backArticles: "Back to Articles",
  viewAllArticles: "View All Articles",
  copyUrl: "Copy article URL",
  copied: "Copied",
  copyFallback: "Select and copy",
  previousPage: "Previous page",
  nextPage: "Next page",
  titleJournal: "Title & Journal",
  year: "Year",
  viewConference: "View conference",
  noConferences: "No conferences available.",
  subject: "Subject",
  downloadPdf: "Download as PDF",
  researchIntro: "Latest publications and research insights.",
  researchTopics: "Research topics",
  allResearch: "All Research",
  viewAllResearch: "View All Research",
  category: "Category",
  pipelineHeading: "Publication Pipeline",
  pipelineIntro: "Active journals and conference submissions.",
  researchTitle: "Research title",
  targetVenue: "Target venue",
  date: "Date",
  status: "Status",
  articlesHeading: "Articles",
  categories: "Categories",
  allArticles: "All Articles",
  mostCited: "Most Cited",
  trendingTopics: "Trending Topics",
  viewAbstract: "View Abstract",
  copyCitation: "Copy Citation",
  aboutAuthor: "About the author",
  continueReading: "Continue reading",
  cvHeading: "Interested in my full background?",
  cvDescription:
    "Download my full academic CV including complete publication history, teaching portfolio, and detailed project descriptions.",
  fullCv: "Download Full CV (PDF)",
  academicLinks: "Academic Links",
  quickMessage: "Quick Message",
  officeHoursHeading: "Office Hours",
  mailingAddressHeading: "Mailing Address",
  namePlaceholder: "Your name",
  emailPlaceholder: "you@university.edu",
  subjectPlaceholder: "Research Collaboration",
  messagePlaceholder: "How can I help you?",
  recentArticles: "Recent Research Articles",
  timelineHeading: "Education & Experience",
  citationHeading: "CITE THIS ARTICLE",
  selectedWork: "Selected research",
  researchAreas: "Research interests",
  footerHeading: "Let’s connect.",
  closeMenu: "Close menu",
  viewPage: "Explore page",
  readMore: "Read full description",
  showLess: "Show less",
  explore: "Explore my work",
  backToTop: "Back to top",
  researchIndex: "Explore the portfolio",
};
export const defaultLabels = { ...baseLabels, ...interactionLabels };
const labelsSchema = z
  .object(
    Object.fromEntries(
      Object.keys(baseLabels).map((key) => [
        key,
        z.string().trim().min(1).max(300),
      ]),
    ) as Record<keyof typeof baseLabels, z.ZodString>,
  )
  .extend(
    Object.fromEntries(
      Object.keys(interactionLabels).map((key) => [
        key,
        z.string().trim().min(1).max(300).optional(),
      ]),
    ) as Record<keyof typeof interactionLabels, z.ZodOptional<z.ZodString>>,
  )
  .strict();
export const documentSchema = z
  .object({
    profile: z
      .object({
        name: short.min(1),
        headline: short,
        headlineHighlight: short.optional(),
        heroBadge: short.optional(),
        heroHeadline: short.optional(),
        heroIntro: z.string().max(10000).optional(),
        showAffiliation: z.boolean().optional(),
        portraitPositionX: z.number().min(0).max(100).optional(),
        portraitPositionY: z.number().min(0).max(100).optional(),
        aboutHeadline: short.optional(),
        aboutBio: z.string().max(10000).optional(),
        collaborationNote: z.string().max(1000).optional(),
        contactHeading: short.optional(),
        contactIntro: z.string().max(1000).optional(),
        officeHours: z.string().max(2000).optional(),
        mailingAddress: z.string().max(2000).optional(),
        contactQuote: z.string().max(2000).optional(),
        quoteAttribution: short.optional(),
        cardsHeading: short.optional(),
        visualEffects: z.enum(["none", "subtle"]).optional(),
        animatedBackground: z.boolean().optional(),
        featureCards: z
          .array(
            z
              .object({
                title: short,
                body: z.string().max(2000),
                icon: z.enum([
                  "research",
                  "education",
                  "collaboration",
                  "idea",
                ]),
                url: profileLinkUrlSchema,
                linkLabel: short,
              })
              .strict(),
          )
          .max(12)
          .optional(),
        logoId: asset.optional(),
        affiliation: short,
        bio: z.string().max(10000),
        location: short,
        email: z.union([z.literal(""), z.email()]),
        portraitId: asset,
        cvId: asset,
        links: z
          .array(
            z.object({
              label: short,
              url: profileLinkUrlSchema,
              showInHero: z.boolean().optional(),
              icon: z
                .enum([
                  "auto",
                  "scholar",
                  "website",
                  "orcid",
                  "twitter",
                  "github",
                  "linkedin",
                  "mail",
                  "link",
                  "none",
                ])
                .optional(),
            }),
          )
          .max(20),
      })
      .strict(),
    seo: z
      .object({
        title: z.string().max(160),
        description: z.string().max(320),
        socialImageId: asset,
        language: z.enum(["en", "bn"]),
        indexable: z.boolean(),
      })
      .strict(),
    theme: z
      .object({
        style: z.enum([
          "shiba",
          "lumen",
          "archive",
          "editorial",
          "modern",
          "classic",
          "aurora",
          "folio",
          "atlas",
          "noir",
          "horizon",
        ]),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        font: z.enum(fontIds),
        bodyFont: z.enum(fontIds).optional(),
        text: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        secondary: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        scale: z.enum(["balanced", "expressive"]).optional(),
        spacing: z.enum(["compact", "generous"]).optional(),
        portrait: z.enum(["rectangle", "arch", "circle", "cutout"]).optional(),
        decoration: z.enum(["none", "glow", "lines"]).optional(),
        motion: z.enum(["none", "subtle", "expressive"]).optional(),
        stickyNavigation: z.boolean().optional(),
        expandableEntries: z.boolean().optional(),
        researchIndex: z.boolean().optional(),
        homeHighlights: z.boolean().optional(),
        width: z.enum(["standard", "wide"]),
        roundness: z.enum(["sharp", "soft"]),
        showAgencyCredit: z.boolean(),
      })
      .strict(),
    navigation: z
      .object({
        articlesEnabled: z.boolean().optional(),
        archivePageSize: z.number().int().min(1).max(50).optional(),
        archiveSort: z.enum(["newest", "oldest", "cited", "title"]).optional(),
        trendingTopics: z
          .array(short)
          .max(50)
          .transform((topics) => [
            ...new Set(
              topics
                .map((topic) => topic.replace(/^#/, "").trim())
                .filter(Boolean),
            ),
          ])
          .optional(),
        siteTitle: short,
        contactLabel: short,
        contactLabelCustomized: z.boolean().optional(),
        cvLabel: short,
        mobileCvLabel: short.optional(),
        footerLinks: z
          .array(z.object({ label: short, url: profileLinkUrlSchema }))
          .max(8)
          .optional(),
        footer: z.string().max(1000),
        copyright: z.string().max(300).optional(),
        layout: z.enum(["pages", "single"]).optional(),
        sectionOrder: z.enum(["academic", "manual"]).optional(),
        homeLabel: short.min(1).optional(),
        menuLabel: short.min(1).optional(),
        pageSettings: z
          .object({
            about: z
              .object({
                title: short.min(1),
                slug: z
                  .string()
                  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                  .max(80),
                description: z.string().max(320),
              })
              .optional(),
            research: z
              .object({
                title: short.min(1),
                slug: z
                  .string()
                  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                  .max(80),
                description: z.string().max(320),
              })
              .optional(),
            contact: z
              .object({
                title: short.min(1),
                slug: z
                  .string()
                  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                  .max(80),
                description: z.string().max(320),
              })
              .optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    labels: labelsSchema,
    sections: z.array(sectionSchema).max(30),
    pages: z
      .array(
        z
          .object({
            id: z.uuid(),
            slug: z
              .string()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .max(80),
            title: short.min(1),
            description: z.string().max(320),
            sections: z.array(sectionSchema).max(20),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((doc, ctx) => {
    {
      // The fixed public design always has separate pages.
      const addresses = ["about", "research", "contact"].map(
        (key) =>
          doc.navigation.pageSettings?.[key as "about" | "research" | "contact"]
            ?.slug || key,
      );
      if (
        new Set(addresses).size !== addresses.length ||
        addresses.some((slug) =>
          [
            "login",
            "publications",
            "article",
            "assets",
            "fonts",
            "index",
            "index.html",
            "sitemap.xml",
            "robots.txt",
          ].includes(slug),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["navigation", "pageSettings"],
          message:
            "Use different, unreserved addresses for About, Research, and Contact.",
        });
    }
    if (
      doc.theme.text &&
      contrastRatio(doc.theme.text, doc.theme.background) < 4.5
    )
      ctx.addIssue({
        code: "custom",
        path: ["theme", "text"],
        message:
          "Body text needs at least 4.5:1 contrast against the background.",
      });
    if (contrastRatio(doc.theme.accent, doc.theme.background) < 4.5)
      ctx.addIssue({
        code: "custom",
        path: ["theme", "accent"],
        message:
          "Choose an accent and background with sufficient contrast for readable links (at least 4.5:1).",
      });
    const ids = [...doc.sections, ...doc.pages.flatMap((p) => p.sections)]
      .flatMap((s) => [s.id, ...s.entries.map((e) => e.id)])
      .concat(doc.pages.map((p) => p.id));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Content IDs must be unique." });
    if (new Set(doc.pages.map((p) => p.slug)).size !== doc.pages.length)
      ctx.addIssue({ code: "custom", message: "Page slugs must be unique." });
    if (
      doc.pages.some((p) =>
        [
          "login",
          "publications",
          "article",
          "sitemap.xml",
          "robots.txt",
          "assets",
        ].includes(p.slug),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "This page address is reserved.",
      });
  });
export type PortfolioDocument = z.infer<typeof documentSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Entry = z.infer<typeof entrySchema>;
export const editableOptions = [
  ["profile.name", "Name"],
  ["profile.headline", "Headline"],
  ["profile.affiliation", "Affiliation"],
  ["profile.bio", "Biography"],
  ["profile.contactQuote", "Personal quote"],
  ["profile.quoteAttribution", "Quote attribution"],
  ["profile.featureCards", "Interest and collaboration cards"],
  ["profile.cardsHeading", "Cards heading"],
  ["profile.visualEffects", "Motion effects"],
  ["profile.animatedBackground", "Animated background"],
  ["profile.location", "Location"],
  ["profile.email", "Public email"],
  ["profile.links", "Profile links"],
  ["profile.portraitId", "Profile photo"],
  ["profile.cvId", "CV"],
  ...sectionTypes.map((type) => [
    `sections.${type}`,
    `${type[0].toUpperCase()}${type.slice(1)} sections`,
  ]),
] as const;
export const allowedFieldsSchema = z
  .array(z.enum(editableOptions.map((x) => x[0]) as [string, ...string[]]))
  .max(editableOptions.length);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
export function emptyDocument(name: string): PortfolioDocument {
  return {
    profile: {
      name,
      headline: "",
      affiliation: "",
      bio: "",
      location: "",
      email: "",
      portraitId: "",
      cvId: "",
      links: [],
    },
    seo: {
      title: "",
      description: "",
      socialImageId: "",
      language: "en",
      indexable: true,
    },
    theme: {
      style: "shiba",
      accent: "#2254a5",
      background: "#ffffff",
      text: "#162438",
      secondary: "#d9e6fa",
      font: "inter",
      bodyFont: "merriweather",
      portrait: "cutout",
      width: "standard",
      roundness: "soft",
      showAgencyCredit: false,
      motion: "subtle",
      stickyNavigation: true,
      expandableEntries: true,
      researchIndex: false,
    },
    navigation: {
      siteTitle: "",
      contactLabel: "Contact",
      cvLabel: "Download CV",
      footer: "",
    },
    labels: { ...defaultLabels },
    sections: [],
    pages: [],
  };
}
export function emptyEntry(): Entry {
  return {
    id: crypto.randomUUID(),
    title: "",
    subtitle: "",
    body: "",
    start: "",
    end: "",
    current: false,
    url: "",
    mediaId: "",
    tags: "",
    authors: "",
    doi: "",
    status: "",
    abstractSource: "",
  };
}
export function canEditDocument(
  before: PortfolioDocument,
  after: PortfolioDocument,
  allowed: string[],
) {
  const normalized = structuredClone(after);
  for (const key of allowed) {
    if (key.startsWith("profile.")) {
      const field = key.slice(8) as keyof PortfolioDocument["profile"];
      if (before.profile[field] === undefined)
        delete (normalized.profile as Record<string, unknown>)[field];
      else
        (normalized.profile as Record<string, unknown>)[field] =
          before.profile[field];
    }
  }
  // Clients can edit existing permitted sections, but cannot add, remove, reorder, or change section identity/type.
  if (before.sections.length !== after.sections.length) return false;
  for (let i = 0; i < before.sections.length; i++) {
    if (
      before.sections[i].id !== after.sections[i].id ||
      before.sections[i].type !== after.sections[i].type ||
      before.sections[i].destination !== after.sections[i].destination
    )
      return false;
    if (allowed.includes(`sections.${before.sections[i].type}`))
      normalized.sections[i] = before.sections[i];
  }
  return canonical(before) === canonical(normalized);
}
export function collectAssetIds(doc: PortfolioDocument) {
  return [
    ...new Set(
      [
        doc.profile.portraitId,
        doc.profile.logoId,
        doc.profile.cvId,
        doc.seo.socialImageId,
        ...[...doc.sections, ...doc.pages.flatMap((p) => p.sections)].flatMap(
          (s) =>
            s.entries.flatMap((e) => [
              e.mediaId,
              e.coverId,
              ...(e.images || []).map((image) => image.mediaId),
            ]),
        ),
      ].filter((id): id is string => !!id),
    ),
  ];
}
export function publicationIssues(doc: PortfolioDocument): string[] {
  const issues: string[] = [];
  if (!doc.profile.name.trim())
    issues.push("Profile: enter the researcher's full name.");
  const education = [
    ...doc.sections,
    ...doc.pages.flatMap((page) => page.sections),
  ]
    .filter((section) => section.visible && section.type === "education")
    .flatMap((section) => section.entries);
  if (!education.length)
    issues.push("Academic sections: add at least one visible education entry.");
  education.forEach((entry, index) => {
    if (!entry.subtitle.trim())
      issues.push(`Education ${index + 1}: enter the institution.`);
    if (!entry.start)
      issues.push(`Education ${index + 1}: enter the start year or date.`);
    if (!entry.current && !entry.end)
      issues.push(
        `Education ${index + 1}: enter the end date or select ongoing.`,
      );
    if (
      entry.start &&
      entry.end &&
      entry.end.padEnd(10, "9") < entry.start.padEnd(10, "0") &&
      !entry.current
    )
      issues.push(
        `Education ${index + 1}: the end date must not precede the start date.`,
      );
  });
  for (const section of [
    ...doc.sections,
    ...doc.pages.flatMap((page) => page.sections),
  ].filter((section) => section.visible)) {
    if (!section.title.trim())
      issues.push("Every visible section needs a heading.");
    for (const entry of section.entries)
      if (!entry.title.trim())
        issues.push(
          `An entry in ${section.title || "an unnamed section"} needs a title.`,
        );
  }
  if (doc.profile.links.some((link) => link.url && !link.label.trim()))
    issues.push("Every public profile link needs a label.");
  return issues;
}
