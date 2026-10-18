import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { extractArticleAssets } from "../src/modules/media/article-assets";
import {
  articleBlocks,
  articleContent,
} from "../src/modules/media/article-content";
import { positionedPageText } from "../src/modules/media/pdf-text";

// Synthetic fixtures: one directly authored PDF and one server-converted DOCX.
it.each(["article-paragraphs.pdf", "article-paragraphs-docx.pdf"])(
  "preserves short source paragraphs, headings and both figures in %s",
  async (file) => {
    const result = await extractArticleAssets(
      await readFile(`tests/fixtures/${file}`),
    );
    const body = articleContent(result.text).body;
    const blocks = articleBlocks(body);
    expect(result.images).toHaveLength(2);
    expect(
      blocks.filter((block) => block.heading).map((block) => block.text),
    ).toEqual(["Introduction", "Methods", "Results", "Conclusion"]);
    expect(blocks.filter((block) => !block.heading)).toHaveLength(9);
    expect(
      blocks.find((block) =>
        block.text.startsWith("This is the first body paragraph."),
      )?.text,
    ).toBe(
      "This is the first body paragraph. It explains the purpose of this software test and must remain separate from the abstract, title, author names, and publication date.",
    );
    expect(body).not.toContain("Alex Example");
    expect(body).not.toContain("This synthetic article verifies");
    expect(body).not.toContain("2025-02-09");
    expect(body.match(/FINAL BODY MARKER/g)).toHaveLength(1);
  },
);

it("keeps double-spaced wrapped lines together and preserves inline word spacing", () => {
  const item = (str: string, x: number, y: number, width = 50) => ({
    str,
    transform: [10, 0, 0, 10, x, y],
    height: 10,
    width,
  });
  expect(
    positionedPageText([
      item("First", 10, 700, 20),
      item("styled word", 33, 700),
      item("wrapped line", 10, 680),
      item("last line", 10, 660),
      item("New paragraph", 10, 625),
      item("continues", 10, 605),
    ]),
  ).toBe(
    "First styled word\nwrapped line\nlast line\n\nNew paragraph\ncontinues",
  );
});
