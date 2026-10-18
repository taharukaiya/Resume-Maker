import { matchingFormat, plainFormat } from "../media/article-format";
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
  const abstract =
    entry.display?.abstract === false
      ? ""
      : articleBlocks(content.abstract)
          .map((block) => block.text)
          .join("\n\n");
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
  for (const [name, family, weight, style] of [
    ["heading", "inter", 700, "normal"],
    ["label", "inter", 400, "normal"],
    ["body", "merriweather", 400, "normal"],
    ["bodyBold", "merriweather", 700, "normal"],
    ["italic", "merriweather", 400, "italic"],
    ["boldItalic", "merriweather", 700, "italic"],
  ] as const) {
    pdf.registerFont(
      name,
      path.join(
        process.cwd(),
        `node_modules/@fontsource/${family}/files/${family}-latin-${weight}-${style}.woff`,
      ),
    );
  }
  const width = pdf.page.width - 116;
  pdf
    .font("heading")
    .fontSize(28)
    .fillColor("#0f172b")
    .text(entry.title, 58, 58, { width, lineGap: 4 })
    .moveDown(0.6);
  if (entry.authors)
    pdf
      .font("bodyBold")
      .fontSize(10)
      .fillColor("#1447e6")
      .text(entry.authors)
      .moveDown(0.5);
  const metadata = [
    entry.start ? formatDate(entry.start) : "",
    entry.journal,
    entry.doi ? `DOI: ${entry.doi}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  if (metadata)
    pdf
      .font("body")
      .fontSize(9)
      .fillColor("#62748e")
      .text(metadata)
      .moveDown(1.2);
  pdf.moveDown(0.5);
  const dividerY = pdf.y;
  pdf
    .save()
    .moveTo(58, dividerY)
    .lineTo(58 + width, dividerY)
    .lineWidth(0.6)
    .strokeColor("#dce4f2")
    .stroke()
    .restore();
  pdf.y = dividerY + 24;
  if (abstract) drawAbstract(pdf, abstract, width);
  let number = 0;
  for (const block of matchingFormat(content.body, entry.formattedBody) ||
    plainFormat(content.body)) {
    const heading = block.kind.startsWith("heading");
    if (heading && pdf.y > pdf.page.height - 130) pdf.addPage();
    number = block.kind === "number" ? number + 1 : 0;
    const prefix =
      block.kind === "bullet"
        ? "\u2022 "
        : block.kind === "number"
          ? `${number}. `
          : "";
    const runs = block.runs.filter((r) => r.text);
    if (!runs.length) {
      pdf.moveDown(0.6);
      continue;
    }
    runs.forEach((run, index) => {
      const bold = run.bold || heading;
      pdf
        .font(
          run.italic
            ? bold
              ? "boldItalic"
              : "italic"
            : bold
              ? heading
                ? "heading"
                : "bodyBold"
              : "body",
        )
        .fontSize(heading ? (block.kind === "heading2" ? 16 : 14) : 11)
        .fillColor(run.color || (heading ? "#0f172b" : "#26354b"))
        .text((index === 0 ? prefix : "") + run.text, {
          width,
          lineGap: Math.max(0, (heading ? 22 : 19.5) - pdf.currentLineHeight()),
          paragraphGap: 0,
          continued: index < runs.length - 1,
          underline: run.underline || false,
        });
    });
    pdf.moveDown(heading ? 0.6 : 0.9);
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

/** Split a long abstract into styled page-sized cards without losing its text. */
function drawAbstract(pdf: PDFKit.PDFDocument, text: string, width: number) {
  const x = 58,
    padding = 22,
    header = 32,
    innerWidth = width - padding * 2;
  const bodyStyle = () => pdf.font("italic").fontSize(10).fillColor("#0f172b");
  bodyStyle();
  const options = {
    width: innerWidth,
    lineGap: Math.max(0, 16.25 - pdf.currentLineHeight()),
    paragraphGap: 8,
  };
  let rest = text.trim();
  let continued = false;
  while (rest) {
    if (pdf.page.height - 58 - pdf.y < 155) pdf.addPage();
    const y = pdf.y;
    const available = pdf.page.height - 58 - y - padding * 2 - header;
    bodyStyle();
    let end = rest.length;
    if (pdf.heightOfString(rest, options) > available) {
      let low = 1,
        high = rest.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (pdf.heightOfString(rest.slice(0, middle), options) <= available)
          low = middle;
        else high = middle - 1;
      }
      end = low;
      const boundary = rest.slice(0, end).search(/\s+\S*$/);
      if (boundary > 0) end = boundary;
    }
    const part = rest.slice(0, end).trimEnd();
    const textHeight = pdf.heightOfString(part, options);
    const height = padding * 2 + header + textHeight;
    pdf.save().roundedRect(x, y, width, height, 10).clip();
    pdf.rect(x, y, width, height).fill("#f8fafc");
    pdf.rect(x, y, 3, height).fill("#1447e6");
    pdf.restore();
    const iconX = x + padding + 6,
      iconY = y + padding + 8;
    pdf
      .save()
      .circle(iconX, iconY, 6)
      .lineWidth(1)
      .strokeColor("#1447e6")
      .stroke();
    pdf.circle(iconX, iconY - 2.5, 0.7).fill("#1447e6");
    pdf
      .moveTo(iconX, iconY)
      .lineTo(iconX, iconY + 3)
      .lineWidth(1)
      .stroke()
      .restore();
    pdf
      .font("heading")
      .fontSize(14)
      .fillColor("#0f172b")
      .text(
        continued ? "Abstract (continued)" : "Abstract",
        x + padding + 18,
        y + padding - 1,
        { width: innerWidth - 18, lineBreak: false },
      );
    bodyStyle().text(part, x + padding, y + padding + header, options);
    pdf.x = x;
    pdf.y = y + height + 26;
    rest = rest.slice(end).trimStart();
    if (rest) {
      pdf.addPage();
      continued = true;
    }
  }
}
