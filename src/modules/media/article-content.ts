/** Source cleanup shared by import, web rendering and downloadable PDFs. No AI rewriting. */
export type ArticleEvidence = {
  title?: string;
  authors?: string;
  abstract?: string;
  category?: string;
  captions?: string[];
};

/** A standalone labeled caption is front-matter separation, not abstract prose. */
export const figureCaptionLine =
  /^\s*(?:figure|fig\.?|table)\s+\d+[a-z]?\s*[.:\u2013\u2014-]\s+\S/i;

/** Remove repeated page-margin text, without deleting matching text in the body. */
export function cleanPdfPageText(pages: { text: string }[]) {
  const rows = pages.map((page) =>
    page.text.replace(/\r\n?/g, "\n").split("\n"),
  );
  const margins = rows.map((lines) => {
    const indexes = lines.flatMap((line, index) =>
      line.trim() ? [index] : [],
    );
    return new Set([...indexes.slice(0, 2), ...indexes.slice(-2)]);
  });
  const counts = new Map<string, number>();
  rows.forEach((lines, page) => {
    for (const value of new Set(
      [...margins[page]].map((index) => lines[index].trim()),
    ))
      if (value.length < 250) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return rows
    .map((lines, page) =>
      lines
        .filter((line, index) => {
          if (!margins[page].has(index)) return true;
          const value = line.trim();
          if (value === String(page + 1)) return false;
          return (
            (counts.get(value) || 0) <
            Math.max(2, Math.ceil(pages.length * 0.6))
          );
        })
        .join("\n"),
    )
    .join("\n\n");
}
const printStamp =
  /^\s*\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?:\s*[AP]M)?\b/i;
const pageMarker =
  /^\s*(?:--\s*\d+\s+of\s+\d+\s*--|(?:page\s+)?\d+\s*(?:\/|of)\s*\d+)\s*$/i;
const wordsPattern = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");

/** Offer cleanup only for fields provably copied from the upload, never edited text. */
export function cleanUntouchedImport<
  T extends {
    fullText?: string;
    body: string;
    title: string;
    authors: string;
    category?: string;
  },
>(entry: T, source: string): T {
  if (!source || entry.fullText !== source) return entry;
  const result = articleContent(source, { ...entry, abstract: entry.body });
  const compact = (text: string) => text.replace(/\s+/g, " ").trim();
  const copiedAbstract =
    !!entry.body.trim() && compact(source).includes(compact(entry.body));
  return {
    ...entry,
    fullText: result.body,
    body: copiedAbstract ? result.abstract : entry.body,
  };
}

export function cleanPrintArtifacts(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  let pageBreak = false;
  for (const line of lines) {
    // This is a website citation widget, not a scholarly References section.
    if (/^\s*cite\s+this\s+article\s*$/i.test(line)) break;
    if (
      printStamp.test(line) ||
      pageMarker.test(line) ||
      /^\s*about:blank(?:\s+\d+\s*\/\s*\d+)?\s*$/i.test(line) ||
      /^\s*https?:\/\/\S+\s+\d+\s*\/\s*\d+\s*$/.test(line)
    ) {
      pageBreak = true;
      continue;
    }
    if (pageBreak) {
      if (!line.trim()) continue;
      const previous = kept.findLastIndex((line) => !!line.trim());
      if (
        previous >= 0 &&
        !/[.!?:;]["”')]*$/.test(kept[previous].trim()) &&
        /^[a-z]/.test(line.trim())
      )
        kept.splice(previous + 1);
      pageBreak = false;
    }
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanArticleAbstract(text: string) {
  // Old imports sometimes placed the entire document after its first print footer
  // in the abstract field. The footer gives an unambiguous end to that excerpt.
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const footer = lines.findIndex(
    (line) => printStamp.test(line) || /^\s*about:blank\b/i.test(line),
  );
  return cleanPrintArtifacts(
    (footer >= 0 ? lines.slice(0, footer) : lines).join("\n"),
  );
}

export function articleContent(raw: string, evidence: ArticleEvidence = {}) {
  let body = cleanPrintArtifacts(raw);
  let abstract = cleanArticleAbstract(evidence.abstract || "");
  let sourceAbstract = "";
  const abstractHeading = raw.match(
    /^[ \t]*(?:abstract|summary)[ \t]*(?:[:：][ \t]*|\n)/im,
  );
  if (abstractHeading && abstractHeading.index! < 4000) {
    const after = raw.slice(abstractHeading.index! + abstractHeading[0].length);
    const boundary = after
      .split("\n")
      .findIndex(
        (line) =>
          printStamp.test(line) ||
          figureCaptionLine.test(line) ||
          /^\s*about:blank\b/i.test(line) ||
          /^\s*(?:(?:\d+\.?\s+)?(?:introduction|background|methods|methodology|results|conclusions?|references)\s*[:：]?\s*$|key\s*words\s*:)/i.test(
            line,
          ),
      );
    if (boundary >= 0) {
      const candidate = after.split("\n").slice(0, boundary).join("\n").trim();
      if (
        /[.!?]["”')]*$/.test(candidate) &&
        candidate.split(/\s+/).length <= 500
      )
        sourceAbstract = candidate;
    }
  }
  abstract ||= sourceAbstract;
  if (sourceAbstract || abstract) {
    const match = body.match(
      new RegExp(wordsPattern(sourceAbstract || abstract), "i"),
    );
    // Only remove duplicate front matter near the start, never a later quotation.
    if (match && match.index! < 5000)
      body = body.slice(match.index! + match[0].length).trim();
  }
  // Otherwise remove only metadata that is explicitly known, at the beginning.
  for (const value of [evidence.category, evidence.title, evidence.authors]) {
    if (!value?.trim()) continue;
    body = body
      .replace(
        new RegExp(
          "^(?:(?:title|authors?|category)[ \\t]*:[ \\t]*)?" +
            wordsPattern(value) +
            "(?:[ \\t]*\\n|$)",
          "i",
        ),
        "",
      )
      .trim();
  }
  body = body
    .replace(
      /^(?:Published(?:[ \t]|:)|(?:publication date|date)[ \t]*:)[^\n]*\n/i,
      "",
    )
    .replace(/^Key\s*words\s*:[^\n]*\n?/i, "")
    .trim();
  // Only remove captions positively identified with extracted images during
  // import. Ordinary references and manually edited prose are left alone.
  for (const caption of evidence.captions || []) {
    if (!caption.trim()) continue;
    body = body.replace(
      new RegExp(
        "(^|\\n)[ \\t]*" + wordsPattern(caption) + "[ \\t]*(?=\\n|$)",
        "g",
      ),
      "$1",
    );
  }
  return {
    abstract,
    body: articleBlocks(body)
      .map((b) => b.text)
      .join("\n\n"),
  };
}

export function articleBlocks(
  text: string,
): { heading: boolean; text: string }[] {
  const blocks: { heading: boolean; text: string }[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length)
      blocks.push({ heading: false, text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading =
      line.length < 130 &&
      (/^(?:\d+(?:\.\d+)*\.?\s+)?(?:introduction|background|literature review|methods?|methodology|results?(?: and discussion)?|discussion|conclusions?|references|bibliography|acknowledg(?:e)?ments?|limitations|research findings)\s*[:：]?$/i.test(
        line,
      ) ||
        /^\d+(?:\.\d+)*\.?\s+[A-Z][^.!?]{2,100}$/.test(line) ||
        (line.length > 3 && /^[A-Z][A-Z \d&:–-]+$/.test(line)));
    if (heading) {
      flush();
      blocks.push({ heading: true, text: line });
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}
