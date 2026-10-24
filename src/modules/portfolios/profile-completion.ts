import type { Entry, PortfolioDocument, Section } from "./schema";

export type CompletionTarget = {
  tab: "profile" | "sections" | "publications" | "articles" | "pages";
  sectionId?: string;
  pageId?: string;
  field?: string;
};
type CompletionCheck = {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
  target: CompletionTarget;
};
const filled = (value?: string) => !!value?.trim();
const core = {
  education: "Education",
  experience: "Experience",
  publications: "Research publications",
  articles: "Articles",
} as const;

export function completionSummary(document: PortfolioDocument) {
  const result = profileCompletion(document);
  return {
    percentage: result.percentage,
    completed: result.completed,
    total: result.checks.length,
    missing: result.checks
      .filter((check) => !check.complete)
      .map(({ id, label }) => ({ id, label })),
  };
}
export type CompletionSummary = ReturnType<typeof completionSummary>;

function entryMissing(entry: Entry, type: Section["type"]): string[] {
  const missing = !filled(entry.title) ? ["title"] : [];
  if (type === "education" || type === "experience") {
    if (!filled(entry.subtitle))
      missing.push(type === "education" ? "institution" : "organization");
    if (!entry.start) missing.push("start date");
    if (!entry.current && !entry.end)
      missing.push("end date or ongoing status");
    if (
      entry.start &&
      entry.end &&
      !entry.current &&
      entry.end.padEnd(10, "9") < entry.start.padEnd(10, "0")
    )
      missing.push("a valid date range");
  }
  if (type === "publications" || type === "articles") {
    if (!filled(entry.authors)) missing.push("authors");
    if (!entry.start) missing.push("publication date");
    if (!filled(entry.body)) missing.push("abstract");
    if (type === "articles" && !filled(entry.fullText))
      missing.push("article body");
  }
  return missing;
}

/** Draft content checklist; never changes publication or domain readiness. */
export function profileCompletion(document: PortfolioDocument) {
  const { profile } = document;
  const checks: CompletionCheck[] = [
    ["name", "Full name", filled(profile.name)],
    ["headline", "Professional headline", filled(profile.headline)],
    ["bio", "Biography", filled(profile.bio)],
    ["portraitId", "Profile photo", filled(profile.portraitId)],
    [
      "email",
      "Contact email or profile link",
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()) ||
        profile.links.some((link) => {
          try {
            const url = new URL(link.url);
            return (
              filled(link.label) &&
              ["https:", "http:"].includes(url.protocol) &&
              !!url.hostname
            );
          } catch {
            return false;
          }
        }),
    ],
  ].map(([field, label, complete]) => ({
    id: `profile-${field}`,
    label: String(label),
    complete: Boolean(complete),
    detail: complete ? "Added" : "Not added yet",
    target: { tab: "profile", field: String(field) },
  }));
  const sections = [
    ...document.sections.map((section) => ({
      section,
      pageId: undefined as string | undefined,
      pageTitle: "",
    })),
    ...document.pages.flatMap((page) =>
      page.sections.map((section) => ({
        section,
        pageId: page.id,
        pageTitle: page.title,
      })),
    ),
  ];
  function sectionCheck(
    items: typeof sections,
    id: string,
    label: string,
    type: Section["type"],
  ): CompletionCheck {
    const visible = items.filter(({ section }) => section.visible);
    const profileContent =
      type === "about"
        ? filled(profile.bio)
        : type === "contact"
          ? checks.find((check) => check.id === "profile-email")?.complete
          : false;
    const unfinished = visible.find(
      ({ section }) =>
        !filled(section.title) ||
        (!section.entries.length &&
          (type in core || (!filled(section.intro) && !profileContent))) ||
        section.entries.some((entry) => entryMissing(entry, type).length),
    );
    const chosen = unfinished || visible[0] || items[0];
    let detail = "Added";
    if (!visible.length)
      detail = items.length
        ? "This section is hidden. Make it visible to include it."
        : "Add a section and its first entry.";
    else if (unfinished) {
      const section = unfinished.section;
      const entry = section.entries.find(
        (entry) => entryMissing(entry, type).length,
      );
      detail = !filled(section.title)
        ? "Add a section heading."
        : entry
          ? `${entry.title.trim() || "Untitled entry"}: add ${entryMissing(entry, type).join(", ")}.`
          : "Add an entry or finish this section’s content.";
    }
    return {
      id,
      label,
      complete: !!visible.length && !unfinished,
      detail,
      target: {
        tab:
          type === "publications" || type === "articles"
            ? type
            : chosen?.pageId
              ? "pages"
              : "sections",
        sectionId: chosen?.section.id,
        pageId: chosen?.pageId,
      },
    };
  }
  for (const [type, label] of Object.entries(core)) {
    checks.push(
      sectionCheck(
        sections.filter(({ section }) => section.type === type),
        type,
        label,
        type as Section["type"],
      ),
    );
  }
  for (const item of sections.filter(
    ({ section }) => section.visible && !(section.type in core),
  )) {
    checks.push(
      sectionCheck(
        [item],
        `section-${item.section.id}`,
        `${item.section.title || item.section.type}${item.pageTitle ? ` · ${item.pageTitle}` : ""}`,
        item.section.type,
      ),
    );
  }
  for (const page of document.pages) {
    if (
      !page.sections.some((section) => section.visible) ||
      !filled(page.title) ||
      !filled(page.slug)
    ) {
      checks.push({
        id: `page-${page.id}`,
        label: page.title || "Untitled page",
        complete: false,
        detail:
          "Add a page title, address and a visible content section, or remove the unused page.",
        target: { tab: "pages", pageId: page.id },
      });
    }
  }
  const completed = checks.filter((check) => check.complete).length;
  return {
    checks,
    completed,
    percentage: Math.round((completed / checks.length) * 100),
  };
}
