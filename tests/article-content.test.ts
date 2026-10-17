import { describe, expect, it } from "vitest";
import {
  cleanUntouchedImport,
  cleanPdfPageText,
  articleContent,
  articleBlocks,
  cleanPrintArtifacts,
} from "../src/modules/media/article-content";

import { printedArticle } from "./fixtures/printed-article";

describe("article content separation", () => {
  it("removes recurring page-margin furniture and page counters without deleting interior content", () => {
    const text = cleanPdfPageText([
      {
        text: "Journal running header\nIntroduction\n\nFirst body paragraph.\n\n1",
      },
      {
        text: "Journal running header\nDifferent body text.\n\nJournal running header\n\nLast paragraph.\n\n2",
      },
    ]);
    expect(text.match(/Journal running header/g)).toHaveLength(1);
    expect(text).toContain("First body paragraph.");
    expect(text).not.toMatch(/^1$|^2$/m);
  });
  it("separates original abstract and body, removes print artifacts and citation UI but preserves scholarly references", () => {
    const result = articleContent(printedArticle, {
      title: "Power and Markets",
      authors: "Ada Lovelace",
    });
    expect(result.abstract).toBe(
      "This original abstract summarizes the actual argument.",
    );
    expect(result.body).toMatch(
      /^Introduction\n\nTrade connects states with different political interests\./,
    );
    expect(result.body).toContain("prolonged public-finance crisis.");
    expect(result.body).toContain("References\n\nLovelace (2024).");
    expect(result.body).not.toMatch(
      /about:blank|10\/17\/26|1 of 3|CITE THIS ARTICLE|Published|typeof window|original abstract/,
    );
    expect(
      articleBlocks(result.body)
        .filter((b) => b.heading)
        .map((b) => b.text),
    ).toEqual(["Introduction", "Methods", "References"]);
  });
  it("preserves edited paragraphs and literal references without rewriting their words", () => {
    const text =
      "My edited paragraph.\n\nAnother paragraph with a date 10/17/26 and reference [1].";
    expect(articleContent(text).body).toBe(text);
    expect(cleanPrintArtifacts("References\n[1] Ada. A paper.")).toBe(
      "References\n[1] Ada. A paper.",
    );
  });
  it("prepares only unchanged imported fields for review and preserves manual content", () => {
    const entry = {
      title: "Power and Markets",
      authors: "Verified Author",
      body: "My manually edited abstract.",
      fullText: printedArticle,
    };
    const cleaned = cleanUntouchedImport(entry, printedArticle);
    expect(cleaned.fullText).not.toContain("about:blank");
    expect(cleaned.body).toBe(entry.body);
    expect(cleaned.fullText).not.toContain("original abstract");
    expect(cleaned.authors).toBe(entry.authors);
    const edited = { ...entry, fullText: "My own corrected text." };
    expect(cleanUntouchedImport(edited, printedArticle)).toBe(edited);
  });
});
