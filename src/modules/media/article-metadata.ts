import { entrySchema } from "../portfolios/schema";
import type { ArticleMetadata } from "../ai/article";

/** Conservative fallback: only explicitly labeled evidence, never guessed bylines. */
export function extractLabeledMetadata(text: string): ArticleMetadata {
  const source = text.replace(/\r\n?/g, "\n");
  const field = (label: string) =>
    source
      .match(new RegExp(`^\\s*(?:${label})\\s*[:：]\\s*([^\\n]+)`, "im"))?.[1]
      ?.trim() || "";
  const abstractMatch = source.match(
    /^\s*(?:abstract|summary)\s*(?:[:：–—-]\s*|\n)([\s\S]*?)(?=\n\s*(?:(?:\d+\.?\s+)?(?:introduction|background|methods|methodology|results|conclusions?|references)\b|key\s*words\b)|(?![\s\S]))/im,
  );
  const abstract = (abstractMatch?.[1]?.trim() || "").slice(0, 12000);
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
