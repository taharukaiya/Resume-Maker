import { z } from "zod";
import { evidenceInstructions } from "./documents";
export const articleMetadataSchema = z
  .object({
    title: z.string().max(200),
    authors: z.string().max(1000),
    date: z.string().max(10),
    journal: z.string().max(200),
    volume: z.string().max(80),
    issue: z.string().max(80),
    pages: z.string().max(80),
    doi: z.string().max(250),
    category: z.string().max(200),
    abstract: z.string().max(12000),
    keywords: z.array(z.string().max(80)).max(12),
    abstractSource: z.enum(["original", "generated"]),
    warnings: z.array(z.string().max(500)).max(20),
  })
  .strict();
export type ArticleMetadata = z.infer<typeof articleMetadataSchema>;
export const articleInstructions = `${evidenceInstructions}
Extract the article title, author names (separate people with semicolons), publication date (YYYY, YYYY-MM or YYYY-MM-DD), journal/venue, volume, issue, pages, DOI, category and keywords. Never use today's date as publication date. Missing strings must be empty.
If an original abstract is explicitly present, preserve its wording and paragraph structure, join typographic line wraps, exclude the Abstract heading and following keywords/body, and set abstractSource=original.
Otherwise write a precise, self-contained abstract grounded only in the document and set abstractSource=generated. Aim for 150–250 words when the document supports that length; use fewer words rather than padding or inventing information. Identify the central question or argument, the approach actually used, the main findings or reasoning, and the supported conclusion. For conceptual essays, summarize the argument without inventing a study, dataset, methods or numerical results. Preserve qualifications, uncertainty and limitations. Avoid promotional language, generic filler, repeated title/byline, citations, lists and meta-commentary about the upload. Use coherent academic prose, not a list of topics. If the source is unreadable or insufficient, leave the abstract empty and explain why in warnings.
Before returning, check each claim, name, date and number against the document. Explain ambiguity and missing evidence in warnings. Do not invent authors, dates, journal details, results or citations. All extracted fields are administrator review proposals.`;
