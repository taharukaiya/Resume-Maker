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
export const articleInstructions = `${evidenceInstructions} Extract the article title, author names (separate people with semicolons), publication date (YYYY, YYYY-MM or YYYY-MM-DD), journal/venue, volume, issue, pages, DOI, category and keywords. Never use today's date as publication date. Missing strings must be empty. If an original abstract is explicitly present, copy it and set abstractSource=original. Otherwise propose a factual 150–250 word abstract from this document and set abstractSource=generated. Explain ambiguity and missing evidence in warnings. Do not invent authors, dates, journal details, results or citations. All extracted fields are administrator review proposals.`;
