import type { PortfolioDocument } from "./schema";

/** Browser identity follows the current person and page, independently of SEO overrides. */
export function portfolioTabTitle(doc: PortfolioDocument, pageTitle?: string) {
  const name = doc.profile.name.trim();
  return pageTitle?.trim()
    ? `${pageTitle.trim()} | ${name}`
    : `${name} | ${doc.profile.headline.trim() || "Research portfolio"}`;
}

/** Derive metadata at render time so edits never leave stale generated values. */
export function portfolioSeo(doc: PortfolioDocument) {
  const compact = (value: string, length: number) => {
    const text = value.replace(/\s+/g, " ").trim();
    return text.length <= length
      ? text
      : text.slice(0, length - 1).replace(/\s+\S*$/, "") + "…";
  };
  const biographyPublic = [
    ...doc.sections,
    ...doc.pages.flatMap((page) => page.sections),
  ].some((section) => section.type === "about" && section.visible);
  return {
    title:
      doc.seo.title.trim() ||
      compact(
        `${doc.profile.name} | ${doc.profile.headline || "Research portfolio"}`,
        160,
      ),
    description:
      doc.seo.description.trim() ||
      compact(
        [
          doc.profile.name,
          doc.profile.headline,
          doc.profile.showAffiliation === true ? doc.profile.affiliation : "",
          biographyPublic ? doc.profile.bio : "",
        ]
          .filter(Boolean)
          .join(". "),
        160,
      ),
    socialImageId: doc.seo.socialImageId || doc.profile.portraitId,
  };
}
