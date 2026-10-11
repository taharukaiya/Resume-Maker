import { AppError, invariant } from "@/lib/errors";
import type { AiTask } from "./documents";

export async function readBrowserDocument(bytes: Buffer, task: AiTask) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const text = (await parser.getText()).text.trim();
    invariant(
      text.length >= 100,
      422,
      "This PDF has too little readable text. Free AI needs a text-based PDF; scanned pages need OCR first.",
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
