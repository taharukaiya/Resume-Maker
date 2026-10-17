import PDFDocument from "pdfkit";
import path from "node:path";
import sharp from "sharp";
import type { Entry } from "../portfolios/schema";
import { formatDate } from "./render";
import { articleContent, articleBlocks } from "../media/article-content";

/** Typeset the reviewed article; source uploads remain unchanged in the library. */
export async function articlePdf(
  entry: Entry,
  canonical: string,
  figures: { bytes: Buffer; caption: string }[] = [],
) {
  const content = articleContent(entry.fullText || "", {
    title: entry.title,
    authors: entry.authors,
    category: entry.category,
    abstract: entry.body,
  });
  const abstract = entry.display?.abstract === false ? "" : content.abstract;
  const pdf = new PDFDocument({
    size: "A4",
    margin: 58,
    bufferPages: true,
    info: {
      Title: entry.title,
      Author: entry.authors,
      Subject: abstract.slice(0, 500),
    },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  pdf.registerFont(
    "heading",
    path.join(
      process.cwd(),
      "node_modules/@fontsource/noto-serif/files/noto-serif-latin-700-normal.woff",
    ),
  );
  pdf.registerFont(
    "body",
    path.join(
      process.cwd(),
      "node_modules/@fontsource/noto-serif/files/noto-serif-latin-400-normal.woff",
    ),
  );
  const width = pdf.page.width - 116;
  pdf
    .font("heading")
    .fontSize(23)
    .fillColor("#0f172b")
    .text(entry.title, { lineGap: 4 })
    .moveDown(0.6);
  if (entry.authors) pdf.fontSize(11).text(entry.authors).moveDown(0.5);
  const metadata = [
    entry.start ? formatDate(entry.start) : "",
    entry.journal,
    entry.doi ? `DOI: ${entry.doi}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  if (metadata)
    pdf.fontSize(9).fillColor("#526078").text(metadata).moveDown(1.2);
  if (abstract) {
    pdf
      .font("heading")
      .fontSize(13)
      .fillColor("#1447e6")
      .text("Abstract")
      .moveDown(0.5);
    pdf
      .font("body")
      .fontSize(10)
      .fillColor("#172033")
      .text(abstract, { lineGap: 4, paragraphGap: 8 })
      .moveDown(1.4);
  }
  for (const block of articleBlocks(content.body)) {
    if (block.heading && pdf.y > pdf.page.height - 130) pdf.addPage();
    pdf
      .font(block.heading ? "heading" : "body")
      .fontSize(block.heading ? 13 : 11)
      .fillColor("#172033")
      .text(block.text, {
        width,
        lineGap: block.heading ? 2 : 4,
        paragraphGap: 0,
      })
      .moveDown(block.heading ? 0.6 : 0.9);
  }
  for (const figure of figures) {
    const image = await sharp(figure.bytes)
      .rotate()
      .resize({
        width: 1400,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    const info = await sharp(image).metadata();
    const scale = Math.min(width / info.width!, 420 / info.height!, 1),
      height = info.height! * scale;
    if (pdf.y + height + 50 > pdf.page.height - 58) pdf.addPage();
    const y = pdf.y;
    pdf.image(image, 58, y, { width: info.width! * scale, height });
    pdf.y = y + height + 10;
    if (figure.caption)
      pdf
        .font("heading")
        .fontSize(9)
        .fillColor("#526078")
        .text(figure.caption, { width })
        .moveDown();
  }
  const pages = pdf.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    pdf.switchToPage(i);
    const bottom = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf
      .font("heading")
      .fontSize(8)
      .fillColor("#62748e")
      .text(`${i + 1} / ${pages.count}`, 58, pdf.page.height - 40, {
        width,
        align: "center",
        lineBreak: false,
      });
    pdf.page.margins.bottom = bottom;
  }
  pdf.end();
  return output;
}
