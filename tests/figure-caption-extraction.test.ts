import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { extractArticleAssets } from "../src/modules/media/article-assets";
import { matchFigureCaptions } from "../src/modules/media/figure-captions";
it("matches captions spatially even when figures are extracted in reverse order", () => {
  const figures = [
    { name: "right", x: 300, y: 10, right: 500, bottom: 100 },
    { name: "left", x: 10, y: 10, right: 210, bottom: 100 },
  ];
  const lines = [
    {
      text: "Figure 1. Left chart",
      x: 10,
      y: 110,
      right: 200,
      bottom: 120,
      height: 10,
    },
    {
      text: "Figure 2. Right chart",
      x: 300,
      y: 110,
      right: 490,
      bottom: 120,
      height: 10,
    },
  ];
  expect(matchFigureCaptions(figures, lines)).toEqual({
    left: "Figure 1. Left chart",
    right: "Figure 2. Right chart",
  });
  expect(
    matchFigureCaptions(
      [figures[0], { ...figures[0], name: "ambiguous" }],
      lines,
    ),
  ).toEqual({});
});
it.each(["article-paragraphs.pdf", "article-paragraphs-docx.pdf"])(
  "extracts captions with the corresponding image from %s",
  async (file) => {
    const result = await extractArticleAssets(
      await readFile(`tests/fixtures/${file}`),
    );

    expect(result.images).toHaveLength(2);
    expect(result.captions).toEqual([
      "Figure 1. Synthetic verification chart.",
      "Figure 2. Synthetic verification chart.",
    ]);
  },
);
