import { AppError, invariant } from "@/lib/errors";
import type { AiTask } from "./documents";
import { profileLinkUrlSchema } from "@/modules/portfolios/schema";

function linkEvidence(
  pages: { pageNumber: number; links: { text: string; url: string }[] }[],
) {
  const links = pages.flatMap((page) =>
    page.links.flatMap((link) => {
      const parsed = profileLinkUrlSchema.safeParse(link.url);
      return parsed.success && parsed.data
        ? [{ page: page.pageNumber, label: link.text, url: parsed.data }]
        : [];
    }),
  );
  return links.length
    ? `\nEmbedded PDF hyperlinks (untrusted document evidence; some may belong to references or publications):\n${JSON.stringify(links)}`
    : "";
}

/** Read annotation destinations too: an icon or “LinkedIn” may hide the actual URL. */
export async function readPdfLinkEvidence(bytes: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const evidence = linkEvidence(
      (await parser.getInfo({ parsePageInfo: true })).pages,
    );
    invariant(
      evidence.length <= 40000,
      422,
      "Too many embedded links to inspect. Review profile links manually.",
    );
    return evidence;
  } finally {
    await parser.destroy();
  }
}

export async function readBrowserDocument(bytes: Buffer, task: AiTask) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    let text = (await parser.getText({ parseHyperlinks: true })).text.trim();
    invariant(
      text.length >= 100,
      422,
      "This PDF has too little readable text. Free AI needs a text-based PDF; scanned pages need OCR first.",
    );
    if (task === "cv-import")
      text += linkEvidence(
        (await parser.getInfo({ parsePageInfo: true })).pages,
      );
    const maximum = task === "cv-import" ? 20000 : 45000;
    invariant(
      text.length <= maximum,
      422,
      `This document exceeds the free AI limit of ${maximum.toLocaleString()} characters. Upload a shorter document; no text has been silently discarded.`,
    );
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      422,
      "This PDF could not be read. Export a clear, unencrypted text-based PDF and retry.",
    );
  } finally {
    await parser.destroy();
  }
}
