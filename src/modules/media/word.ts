import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { AppError, invariant } from "@/lib/errors";
const run = promisify(execFile);
export function wordExtension(filename: string, mime?: string) {
  if (
    /\.docx$/i.test(filename) &&
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (
    /\.doc$/i.test(filename) &&
    ["application/msword", "application/x-cfb"].includes(mime || "")
  )
    return "doc";
  return null;
}
export async function wordToPdf(bytes: Buffer, extension: "doc" | "docx") {
  const directory = await mkdtemp(path.join(tmpdir(), "brilliancy-word-"));
  try {
    const profile = path.join(directory, "profile");
    await mkdir(path.join(profile, "user"), { recursive: true });
    await writeFile(
      path.join(profile, "user", "registrymodifications.xcu"),
      `<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item></oor:items>`,
    );
    const source = path.join(directory, `article.${extension}`);
    await writeFile(source, bytes, { mode: 0o600 });
    try {
      await run(
        process.env.LIBREOFFICE_BIN || "libreoffice",
        [
          `-env:UserInstallation=${pathToFileURL(profile).href}`,
          "--headless",
          "--nologo",
          "--nodefault",
          "--norestore",
          "--convert-to",
          "pdf:writer_pdf_Export",
          "--outdir",
          directory,
          source,
        ],
        { timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true },
      );
    } catch (error) {
      throw new AppError(
        (error as NodeJS.ErrnoException).code === "ENOENT" ? 503 : 422,
        "Word conversion could not finish. Check LibreOffice on the server, or export this document to PDF and retry.",
      );
    }
    let pdf: Buffer;
    try {
      pdf = await readFile(path.join(directory, "article.pdf"));
    } catch {
      throw new AppError(
        422,
        "This Word document could not be converted. Check that it is readable and not password-protected.",
      );
    }
    invariant(
      pdf.subarray(0, 5).toString() === "%PDF-" &&
        pdf.length <= 20 * 1024 * 1024,
      422,
      "The converted PDF is invalid or exceeds 20 MB.",
    );
    return pdf;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
