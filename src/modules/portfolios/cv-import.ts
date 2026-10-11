import { z } from "zod";
import { orderSections } from "./structure";
import {
  documentSchema,
  emptyEntry,
  entrySchema,
  sectionSchema,
  type PortfolioDocument,
} from "./schema";

export const cvProfileFields = [
  "name",
  "headline",
  "affiliation",
  "bio",
  "location",
  "email",
] as const;
export const cvSectionTypes = [
  "education",
  "experience",
  "publications",
  "projects",
  "awards",
  "skills",
  "custom",
] as const;
// Keep the model's output simple; validate dates, URLs and lengths against the
// actual portfolio schema before offering any information for review.
export const cvExtractionSchema = z
  .object({
    profile: z
      .object({
        name: z.string(),
        headline: z.string(),
        affiliation: z.string(),
        bio: z.string(),
        location: z.string(),
        email: z.string(),
        links: z.array(
          z.object({ label: z.string(), url: z.string() }).strict(),
        ),
      })
      .strict(),
    sections: z.array(
      z
        .object({
          type: z.enum(cvSectionTypes),
          title: z.string(),
          entries: z.array(
            z
              .object({
                title: z.string(),
                subtitle: z.string(),
                body: z.string(),
                start: z.string(),
                end: z.string(),
                current: z.boolean(),
                url: z.string(),
                tags: z.string(),
                authors: z.string(),
                doi: z.string(),
                status: z.enum([
                  "",
                  "published",
                  "accepted",
                  "preprint",
                  "submitted",
                  "in-progress",
                ]),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    warnings: z.array(z.string()),
  })
  .strict();
export type CvExtraction = z.infer<typeof cvExtractionSchema>;
export type CvSelection = {
  profile: string[];
  entries: string[];
  links: boolean;
  replace: boolean;
};
export const cvEntryKey = (section: number, entry: number) =>
  `${section}:${entry}`;
export function applyCvImport(
  document: PortfolioDocument,
  result: CvExtraction,
  selection: CvSelection,
): PortfolioDocument {
  const next = structuredClone(document);
  for (const key of cvProfileFields) {
    if (
      selection.profile.includes(key) &&
      result.profile[key] &&
      (selection.replace || !next.profile[key])
    ) {
      next.profile[key] = documentSchema.shape.profile.shape[key].parse(
        result.profile[key],
      );
      if (key === "bio" && !next.sections.some((s) => s.type === "about"))
        next.sections.unshift({
          id: crypto.randomUUID(),
          type: "about",
          title: "About",
          intro: "",
          visible: true,
          entries: [],
        });
    }
  }
  if (selection.links)
    for (const link of result.profile.links) {
      if (
        link.url &&
        !next.profile.links.some((existing) => existing.url === link.url)
      )
        next.profile.links.push(
          documentSchema.shape.profile.shape.links.element.parse(link),
        );
    }
  result.sections.forEach((section, si) => {
    const chosen = section.entries.filter((_, ei) =>
      selection.entries.includes(cvEntryKey(si, ei)),
    );
    if (!chosen.length) return;
    let target = next.sections.find(
      (s) =>
        s.type === section.type &&
        (s.type !== "custom" || s.title === section.title),
    );
    if (!target) {
      target = {
        id: crypto.randomUUID(),
        type: section.type,
        title: sectionSchema.shape.title.parse(section.title),
        visible: true,
        intro: "",
        entries: [],
      };
      next.sections.push(target);
    }
    for (const entry of chosen) {
      const validated = entrySchema.parse({ ...emptyEntry(), ...entry });
      // Reapplying a proposal must not duplicate the same academic record.
      const duplicate = target.entries.some(
        (e) =>
          e.title === entry.title &&
          e.subtitle === entry.subtitle &&
          e.start === entry.start,
      );
      if (!duplicate) target.entries.push(validated);
    }
  });
  // Applying reviewed facts is a local edit. Unfinished pages or other fields
  // must not block it; the complete document is validated when saved/published.
  next.sections = orderSections(next.sections, next.navigation.sectionOrder);
  return next;
}
