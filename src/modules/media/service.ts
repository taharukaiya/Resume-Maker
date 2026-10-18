import { extractLabeledMetadata } from "./article-metadata";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { deleteObject, putObject } from "@/lib/storage";
import {
  audit,
  rateLimit,
  siteAccess,
  type User,
} from "@/modules/auth/service";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "node:crypto";
import net from "node:net";
import sharp from "sharp";
import { aiConfig } from "@/modules/ai/config";
import { wordExtension, wordToPdf } from "./word";
import { extractArticleAssets, type ArticleAssets } from "./article-assets";
export type Media = {
  article_assets?: ArticleAssets | null;
  article_metadata?: import("@/modules/ai/article").ArticleMetadata | null;
  extracted_text?: string | null;
  cv_import?: import("@/modules/portfolios/cv-import").CvExtraction | null;
  id: string;
  site_id: string;
  filename: string;
  mime: string;
  bytes: number;
  storage_key: string;
  summary: null | {
    abstract: string;
    keywords: string[];
    limitations: string;
    model: string;
    generatedAt: string;
  };
  created_at: string;
};
export async function scanFile(buffer: Buffer) {
  const host = process.env.CLAMAV_HOST;
  invariant(
    host || !config().production || config().demo,
    503,
    "Upload scanning must be configured before production uploads.",
  );
  if (!host) return;
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({
      host,
      port: Number(process.env.CLAMAV_PORT || 3310),
    });
    let result = "";
    socket.setTimeout(60000);
    socket.on("timeout", () =>
      socket.destroy(new Error("Malware scanner timed out.")),
    );
    socket.on("error", reject);
    socket.on("data", (chunk) => {
      result += chunk.toString();
      if (result.includes("\0")) {
        socket.end();
        if (/: OK\0/.test(result)) resolve();
        else reject(new Error("The file did not pass malware scanning."));
      }
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buffer.length; offset += 65536) {
        const chunk = buffer.subarray(offset, offset + 65536);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("end", () => {
      if (!result.includes("\0"))
        reject(new Error("Malware scanner returned an incomplete response."));
    });
  });
}
export async function upload(
  user: User,
  siteId: string,
  file: File,
  purpose: "article" | "cv" | "image" = "article",
) {
  await siteAccess(user, siteId);
  const database = await db();
  if (config().demo) {
    invariant(
      user.role === "admin",
      403,
      "Demo uploads are restricted to administrators. Use sample documents only.",
    );
    invariant(
      file.size <= 5 * 1024 * 1024,
      400,
      "The free demo accepts files up to 5 MB.",
    );
  }
  if (user.role === "client") {
    const [site] = await database.query<{ editable_fields: string[] }>(
      "SELECT editable_fields FROM sites WHERE id=$1",
      [siteId],
    );
    invariant(
      site.editable_fields.some(
        (f) =>
          ["profile.portraitId", "profile.cvId"].includes(f) ||
          f.startsWith("sections."),
      ),
      403,
      "File uploads are disabled for your account.",
    );
  }
  invariant(
    file.size > 0 && file.size <= 20 * 1024 * 1024,
    400,
    "Upload a file between 1 byte and 20 MB.",
  );
  let bytes = Buffer.from(await file.arrayBuffer());
  const kind = await fileTypeFromBuffer(bytes);
  const word = wordExtension(file.name, kind?.mime);
  invariant(
    kind &&
      (word ||
        ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          kind.mime,
        )),
    400,
    "Supported files: DOC, DOCX, PDF, JPG, PNG, and WebP.",
  );
  await scanFile(bytes);
  if (word) {
    invariant(
      user.role === "admin" && purpose === "article",
      403,
      "Word article uploads are restricted to administrators.",
    );
    bytes = Buffer.from(await wordToPdf(bytes, word));
    await scanFile(bytes);
  }
  let mime = word ? "application/pdf" : kind.mime;
  if (mime.startsWith("image/")) purpose = "image";
  const summaryQueued =
    purpose === "article" &&
    mime === "application/pdf" &&
    user.role === "admin" &&
    aiConfig().server;
  if (summaryQueued) await rateLimit(`abstract:${user.id}`, 20, 3600);
  let extension = word ? "pdf" : kind.ext;
  if (mime.startsWith("image/")) {
    bytes = Buffer.from(
      await sharp(bytes, { limitInputPixels: 40000000 })
        .rotate()
        .resize({
          width: 1800,
          height: 1800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 84 })
        .toBuffer(),
    );
    mime = "image/webp";
    extension = "webp";
  }
  const id = randomUUID(),
    key = `private/${siteId}/${id}.${extension}`;
  const extraction =
    purpose === "article" && mime === "application/pdf" && user.role === "admin"
      ? await extractArticleAssets(bytes)
      : undefined;
  const figures = (extraction?.images || []).map((data, index) => {
    const imageId = randomUUID();
    return {
      id: imageId,
      data,
      key: `private/${siteId}/${imageId}.webp`,
      filename: `Figure ${index + 1} — ${file.name
        .replace(/[\r\n\\/]/g, "")
        .replace(/\.[^.]+$/, "")
        .slice(0, 150)}.webp`,
    };
  });
  const storedKeys: string[] = [];
  try {
    await putObject(key, bytes, mime);
    storedKeys.push(key);
    for (const figure of figures) {
      await putObject(figure.key, figure.data, "image/webp");
      storedKeys.push(figure.key);
    }
    await database.transaction(async (tx) => {
      await tx.query("SELECT id FROM sites WHERE id=$1 FOR UPDATE", [siteId]);
      const [usage] = await tx.query<{ total: string }>(
        "SELECT COALESCE(SUM(bytes),0) AS total FROM media WHERE site_id=$1",
        [siteId],
      );
      invariant(
        Number(usage.total) +
          bytes.length +
          figures.reduce((sum, figure) => sum + figure.data.length, 0) <=
          100 * 1024 * 1024,
        400,
        "This portfolio has reached its 100 MB media allowance.",
      );
      await tx.query(
        "INSERT INTO media(id,site_id,filename,mime,bytes,storage_key,uploaded_by,purpose) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          siteId,
          (word ? file.name.replace(/\.docx?$/i, ".pdf") : file.name)
            .replace(/[\r\n\\/]/g, "")
            .slice(0, 200),
          mime,
          bytes.length,
          key,
          user.id,
          purpose,
        ],
      );
      if (extraction) {
        await tx.query(
          "UPDATE media SET extracted_text=$1,article_assets=$2,article_metadata=$4 WHERE id=$3",
          [
            extraction.text,
            JSON.stringify({
              imageIds: figures.map((figure) => figure.id),
              captions: Object.fromEntries(
                figures.map((figure, index) => [
                  figure.id,
                  extraction.captions[index] || "",
                ]),
              ),
              warnings: extraction.warnings,
            }),
            id,
            JSON.stringify(extractLabeledMetadata(extraction.text)),
          ],
        );
        for (const figure of figures)
          await tx.query(
            "INSERT INTO media(id,site_id,filename,mime,bytes,storage_key,uploaded_by,purpose) VALUES($1,$2,$3,'image/webp',$4,$5,$6,'image')",
            [
              figure.id,
              siteId,
              figure.filename,
              figure.data.length,
              figure.key,
              user.id,
            ],
          );
      }
      if (summaryQueued)
        await tx.query(
          "INSERT INTO jobs(id,site_id,kind,payload) VALUES($1,$2,'abstract',$3)",
          [randomUUID(), siteId, JSON.stringify({ mediaId: id })],
        );
      await audit(
        user.id,
        siteId,
        "media.uploaded",
        { mediaId: id, bytes: bytes.length },
        tx,
      );
    });
  } catch (error) {
    await Promise.all(storedKeys.map((stored) => deleteObject(stored)));
    throw error;
  }
  return { id, summaryQueued };
}
