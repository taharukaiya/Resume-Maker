import { z } from "zod";
import { articleBlocks } from "./article-content";

const runSchema = z.object({
  text: z.string().max(240000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});
export const articleFormatSchema = z
  .array(
    z.object({
      kind: z.enum([
        "paragraph",
        "heading2",
        "heading3",
        "bullet",
        "number",
        "quote",
      ]),
      runs: z.array(runSchema).max(10000),
    }),
  )
  .max(5000)
  .refine(
    (blocks) =>
      blocks.reduce(
        (n, b) => n + b.runs.reduce((m, r) => m + r.text.length, 0),
        0,
      ) <= 240000,
    "Article body is too long",
  );
export type ArticleFormat = z.infer<typeof articleFormatSchema>;
export function formatText(blocks: ArticleFormat) {
  return blocks.map((b) => b.runs.map((r) => r.text).join("")).join("\n\n");
}
export function matchingFormat(text: string, blocks?: ArticleFormat) {
  return blocks &&
    formatText(blocks).replace(/\s+/g, " ").trim() ===
      text.replace(/\s+/g, " ").trim()
    ? blocks
    : undefined;
}
export function plainFormat(text: string): ArticleFormat {
  return articleBlocks(text).map((b) => ({
    kind: b.heading ? "heading2" : "paragraph",
    runs: [{ text: b.text }],
  }));
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Only validated styles and escaped text are emitted, never pasted HTML. */
export function formatHtml(blocks: ArticleFormat) {
  let number = 0;
  return blocks
    .map((b) => {
      number = b.kind === "number" ? number + 1 : 0;
      const tag =
        b.kind === "heading2"
          ? "h2"
          : b.kind === "heading3"
            ? "h3"
            : b.kind === "quote"
              ? "blockquote"
              : "p";
      const prefix =
        b.kind === "bullet"
          ? "&#8226; "
          : b.kind === "number"
            ? `${number}. `
            : "";
      return `<${tag}>${prefix}${b.runs
        .map((r) => {
          let text = escape(r.text).replace(/\n/g, "<br>");
          if (r.bold) text = `<strong>${text}</strong>`;
          if (r.italic) text = `<em>${text}</em>`;
          if (r.underline) text = `<u>${text}</u>`;
          if (r.color && /^#[0-9a-f]{6}$/i.test(r.color))
            text = `<span style="color:${r.color}">${text}</span>`;
          return text;
        })
        .join("")}</${tag}>`;
    })
    .join("");
}

/** Share presentation-only paragraph recovery between web and PDF. Saved edits stay intact. */
export function bodyFormat(
  text: string,
  blocks?: ArticleFormat,
): ArticleFormat {
  const edited = matchingFormat(text, blocks);
  if (edited) return edited;
  return plainFormat(text).flatMap((block) => {
    const value = block.runs[0].text;
    if (block.kind !== "paragraph" || value.split(/\s+/).length < 220)
      return [block];
    // Imported text sometimes has no paragraph boundaries. Break only at complete
    // sentence boundaries, retaining every word and never inventing section titles.
    const sentences = value.match(
      /[^.!?]+[.!?]+(?:["”’)]*)(?:\s+|$)|[^.!?]+$/g,
    ) || [value];
    const paragraphs: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      current += sentence;
      if (current.trim().split(/\s+/).length >= 110) {
        paragraphs.push(current.trim());
        current = "";
      }
    }
    if (current.trim()) paragraphs.push(current.trim());
    // Do not risk losing unusual punctuation if the sentence matcher cannot round-trip.
    if (
      paragraphs.join(" ").replace(/\s+/g, " ") !==
      value.replace(/\s+/g, " ").trim()
    )
      return [block];
    return paragraphs.map((text) => ({
      kind: "paragraph" as const,
      runs: [{ text }],
    }));
  });
}
