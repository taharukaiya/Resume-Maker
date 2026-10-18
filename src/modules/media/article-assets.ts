import { createHash } from "node:crypto";
import sharp from "sharp";
import { cleanPdfPageText } from "./article-content";
import { extractPositionedText } from "./pdf-text";

export type ArticleAssets = { imageIds: string[]; warnings: string[] };

/** Embedded figures, rather than screenshots of pages. Runs without an AI key. */
export async function extractArticleAssets(bytes: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: bytes,
    maxImageSize: 4000000,
    isEvalSupported: false,
  });
  const images: Buffer[] = [],
    warnings: string[] = [],
    seen = new Set<string>();
  let text = "",
    totalBytes = 0;
  try {
    const info = await parser.getInfo();
    const pages = Math.min(info.total, 40);
    if (info.total > pages)
      warnings.push(
        "Automatic extraction covers the first 40 pages. The downloadable PDF retains every page.",
      );
    try {
      const extracted = cleanPdfPageText(
        await extractPositionedText(bytes, pages),
      );
      text = extracted.slice(0, 240000);
      if (extracted.length > 240000)
        warnings.push(
          "Extracted display text was shortened to 240,000 characters. The PDF remains complete.",
        );
      if (!text.trim())
        warnings.push(
          "This PDF has no readable text layer. Enter text manually or use AI extraction for a scanned document.",
        );
    } catch {
      warnings.push(
        "Text could not be read automatically. Enter article text manually or use AI extraction for a scanned PDF.",
      );
    }
    for (let page = 1; page <= pages; page++) {
      try {
        const result = await parser.getImage({
          partial: [page],
          imageThreshold: 32,
          imageDataUrl: false,
          imageBuffer: true,
        });
        for (const image of result.pages.flatMap((p) => p.images)) {
          if (!image.data.length) continue;
          const optimized = await sharp(image.data, {
            limitInputPixels: 4000000,
          })
            .resize({
              width: 1800,
              height: 1800,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 84 })
            .toBuffer();
          const hash = createHash("sha256").update(optimized).digest("hex");
          if (seen.has(hash)) continue;
          seen.add(hash);
          if (
            images.length >= 24 ||
            totalBytes + optimized.length > 16 * 1024 * 1024
          ) {
            warnings.push(
              "Automatic extraction reached its 24-image / 16 MB limit. Upload any remaining figures separately.",
            );
            return { images, text, warnings };
          }
          images.push(optimized);
          totalBytes += optimized.length;
        }
      } catch {
        warnings.push(
          `Some images on page ${page} could not be extracted. You can upload or replace them manually.`,
        );
      }
    }
    warnings.push(
      "Review extracted figures before publishing. Small decorations, vector drawings and images over 4 megapixels may need a separate image upload.",
    );
  } catch {
    warnings.push(
      "This document could not be extracted automatically. The PDF is available; enter details and upload images manually.",
    );
  } finally {
    await parser.destroy().catch(() => undefined);
  }
  return { images, text, warnings };
}
