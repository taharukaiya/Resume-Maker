import type { PortfolioDocument, Section } from "./schema";

/** Edit one section group without moving or removing the other groups. */
export function replaceSectionGroup(
  sections: Section[],
  next: Section[],
  matches: (section: Section) => boolean,
) {
  const remaining = [...next];
  const merged = sections.flatMap((section) => {
    if (!matches(section)) return [section];
    const replacement = remaining.shift();
    return replacement ? [replacement] : [];
  });
  return [...merged, ...remaining];
}

export const academicOrder = [
  "about",
  "education",
  "experience",
  "publications",
  "projects",
  "awards",
  "skills",
  "custom",
  "contact",
];
export const pageDefaults = {
  about: { title: "About", slug: "about", description: "" },
  research: { title: "Research", slug: "research", description: "" },
  contact: { title: "Contact", slug: "contact", description: "" },
};
export type PageDestination = keyof typeof pageDefaults;
export function orderSections(sections: Section[], order = "academic") {
  return order === "manual"
    ? sections
    : [...sections].sort(
        (a, b) => academicOrder.indexOf(a.type) - academicOrder.indexOf(b.type),
      );
}
export function sectionDestination(section: Section): "home" | PageDestination {
  if (section.destination && section.destination !== "auto")
    return section.destination;
  if (["publications", "projects"].includes(section.type)) return "research";
  return section.type === "contact" ? "contact" : "about";
}
export type PortfolioPage = {
  slug: string;
  title: string;
  description: string;
  sections: Section[];
};
export function portfolioPages(doc: PortfolioDocument): {
  home: Section[];
  pages: PortfolioPage[];
} {
  const ordered = orderSections(doc.sections, doc.navigation.sectionOrder);
  if (doc.navigation.layout === "single")
    return {
      home: ordered,
      pages: doc.pages.map((p) => ({
        ...p,
        sections: orderSections(p.sections, "manual"),
      })),
    };
  const pages: PortfolioPage[] = [];
  const allSections = [
    ...doc.sections,
    ...doc.pages.flatMap((page) => page.sections),
  ];
  for (const key of Object.keys(pageDefaults) as PageDestination[]) {
    const setting = {
      ...pageDefaults[key],
      ...doc.navigation.pageSettings?.[key],
    };
    const sections = ordered.filter((s) => sectionDestination(s) === key);
    // Biography and contact information already belong to the profile. Present
    // them on their own pages without copying or changing the saved document.
    if (
      key === "about" &&
      doc.profile.bio &&
      !allSections.some((s) => s.type === "about")
    )
      sections.unshift({
        id: "profile-biography",
        type: "about",
        title: setting.title,
        intro: "",
        visible: true,
        entries: [],
      });
    if (key === "contact" && !allSections.some((s) => s.type === "contact"))
      sections.push({
        id: "profile-contact",
        type: "contact",
        title: doc.navigation.contactLabel || setting.title,
        intro: "",
        visible: true,
        entries: [],
      });
    const custom = doc.pages.find((p) => p.slug === setting.slug);
    if (sections.some((s) => s.visible) || custom)
      pages.push({
        ...setting,
        ...(custom || {}),
        sections: [...sections, ...(custom?.sections || [])],
      });
  }
  pages.push(
    ...doc.pages.filter(
      (p) => !pages.some((existing) => existing.slug === p.slug),
    ),
  );
  return {
    home: ordered.filter((s) => sectionDestination(s) === "home"),
    pages,
  };
}
