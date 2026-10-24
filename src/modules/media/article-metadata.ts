import { entrySchema } from "../portfolios/schema";
import type { ArticleMetadata } from "../ai/article";
import { figureCaptionLine } from "./article-content";

/** Conservative fallback: only explicitly labeled evidence, never guessed bylines. */
export function extractLabeledMetadata(text: string): ArticleMetadata {
  const source = text.replace(/\r\n?/g, "\n");
  const field = (label: string) =>
    source
      .match(new RegExp(`^\\s*(?:${label})\\s*[:：]\\s*([^\\n]+)`, "im"))?.[1]
      ?.trim() || "";
  const abstractMatch = source.match(
    /^[ \t]*(?:abstract|summary)[ \t]*(?:[:\uFF1A\u2013\u2014-][ \t]*|\n)([\s\S]*?)(?=\n[ \t]*(?:(?:\d+\.?[ \t]+)?(?:introduction|background|methods|methodology|results|conclusions?|references)[ \t]*[:\uFF1A]?[ \t]*(?:\n|$)|key[ \t]*words[ \t]*[:\uFF1A])|(?![\s\S]))/im,
  );
  const abstractLines = (abstractMatch?.[1] || "").split("\n");
  const captionStart = abstractLines.findIndex((line) =>
    figureCaptionLine.test(line),
  );
  const candidate = (
    captionStart < 0 ? abstractLines : abstractLines.slice(0, captionStart)
  )
    .join("\n")
    .trim();
  // Page footers and long, unbounded blocks are ambiguous. Leave these to AI
  // review instead of replacing its proposal with accidentally captured body text.
  const uncertain =
    candidate.split(/\s+/).length > 500 ||
    /(?:about:blank|https?:\/\/\S+)[ \t]+\d+\s*\/\s*\d+|--\s*\d+\s+of\s+\d+\s*--/i.test(
      candidate,
    );
  const abstract = uncertain ? "" : candidate.slice(0, 12000);
  const rawDate = field("publication date|published|date");
  const date = entrySchema.shape.start.safeParse(rawDate).success
    ? rawDate
    : "";
  const authors = field("authors?").slice(0, 1000);
  return {
    title: field("title").slice(0, 200),
    authors,
    date,
    journal: field("journal").slice(0, 200),
    volume: "",
    issue: "",
    pages: "",
    doi: field("doi").slice(0, 250),
    category: "",
    abstract,
    keywords: field("key\\s*words")
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((v) => v.slice(0, 80)),
    abstractSource: "original",
    warnings: [
      ...(!abstract
        ? [
            "No labeled abstract was found. Run AI extraction or enter an abstract before publishing.",
          ]
        : []),
      ...(!authors ? ["Author names need review or manual entry."] : []),
      ...(!date ? ["Publication date needs review or manual entry."] : []),
    ],
  };
}
