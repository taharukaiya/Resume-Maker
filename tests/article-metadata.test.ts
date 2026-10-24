import { describe, expect, it } from "vitest";
import { extractLabeledMetadata } from "../src/modules/media/article-metadata";

describe("article metadata without AI", () => {
  it("does not absorb an image caption between the abstract and first heading", () => {
    expect(
      extractLabeledMetadata(
        "Abstract\nOriginal findings.\n\nFigure 1. Coastal chart.\nIntroduction\nBody.",
      ).abstract,
    ).toBe("Original findings.");
  });
  it("does not mistake words within abstract prose for section headings", () => {
    const result = extractLabeledMetadata(
      "Abstract\nWe report key\nresults/outcomes and their implications.\n1. Introduction\nBody text.",
    );
    expect(result.abstract).toBe(
      "We report key\nresults/outcomes and their implications.",
    );
  });
  it("leaves ambiguous multi-page browser exports for review", () => {
    const result = extractLabeledMetadata(
      "Abstract\nThe original summary.\nabout:blank 1/5\n-- 1 of 5 --\nArticle body without a heading.",
    );
    expect(result.abstract).toBe("");
    expect(result.warnings.join(" ")).toContain("abstract");
  });
  it("extracts explicit evidence and keeps the original abstract paragraphs", () => {
    const result = extractLabeledMetadata(`Title: Coastal resilience
Authors: Ada Lovelace; Alan Turing
Published: 2025-02-09
ABSTRACT
We examined coastal observations.

The observations showed seasonal changes.
Keywords: Oceans, Climate
1. Introduction
This is not the abstract.`);
    expect(result.title).toBe("Coastal resilience");
    expect(result.authors).toBe("Ada Lovelace; Alan Turing");
    expect(result.date).toBe("2025-02-09");
    expect(result.abstract).toBe(
      "We examined coastal observations.\n\nThe observations showed seasonal changes.",
    );
    expect(result.abstractSource).toBe("original");
    expect(result.keywords).toEqual(["Oceans", "Climate"]);
  });
  it("never invents metadata from unlabeled text or invalid dates", () => {
    const result = extractLabeledMetadata(
      "A paper by someone\nDate: 2025-02-30\nResearch discusses abstract concepts.",
    );
    expect(result.abstract).toBe("");
    expect(result.authors).toBe("");
    expect(result.date).toBe("");
    expect(result.warnings).toHaveLength(3);
  });
  it("handles inline abstracts and CRLF documents", () => {
    const result = extractLabeledMetadata(
      "Author: Jane Doe\r\nDate: 2024\r\nAbstract: Original findings.\r\nMethods\r\nOther text.",
    );
    expect(result.abstract).toBe("Original findings.");
    expect(result.authors).toBe("Jane Doe");
    expect(result.date).toBe("2024");
  });
});
