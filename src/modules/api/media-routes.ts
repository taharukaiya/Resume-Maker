import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { deleteObject, getObject } from "@/lib/storage";
import {
  audit,
  rateLimit,
  requireAdmin,
  siteAccess,
  type User,
} from "@/modules/auth/service";
import { type Media } from "@/modules/media/service";
import { collectAssetIds } from "@/modules/portfolios/schema";
import { getSite } from "@/modules/portfolios/service";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { idSchema, json } from "./shared";
import { body } from "./shared";
import { z } from "zod";
import { aiConfig } from "@/modules/ai/config";
import {
  browserModel,
  summarySchema,
  validateCv,
} from "@/modules/ai/documents";
import { readBrowserDocument } from "@/modules/ai/pdf";

export async function mediaRoutes(
  request: NextRequest,
  path: string[],
  database: Awaited<ReturnType<typeof db>>,
  user: User,
): Promise<Response | null> {
  const route = path.join("/"),
    method = request.method;
  if (path[0] === "media" && path[1]) {
    const id = idSchema.parse(path[1]);
    const [media] = await database.query<Media>(
      "SELECT * FROM media WHERE id=$1",
      [id],
    );
    invariant(media, 404, "File not found.");
    await siteAccess(user, media.site_id);
    if (
      path.length === 3 &&
      path[2] === "browser-ai" &&
      ["POST", "PUT"].includes(method)
    ) {
      requireAdmin(user);
      invariant(
        aiConfig().provider === "huggingface-browser",
        409,
        "Browser AI is not enabled on this installation.",
      );
      invariant(
        media.mime === "application/pdf",
        400,
        "Select a PDF document.",
      );
      const input = z
        .object({
          task: z.enum(["cv-import", "abstract"]),
          result: z.unknown().optional(),
        })
        .strict()
        .parse(await body(request));
      await rateLimit(`browser-ai:${user.id}`, 40, 3600);
      if (method === "POST") {
        const bytes = await getObject(media.storage_key);
        invariant(bytes, 404, "The document could not be read.");
        return json({ text: await readBrowserDocument(bytes, input.task) });
      }
      // Browser output is untrusted administrator input, not verified model provenance.
      const result =
        input.task === "cv-import"
          ? validateCv(input.result)
          : summarySchema.parse(input.result);
      await database.transaction(async (tx) => {
        if (input.task === "cv-import") {
          await tx.query(
            "UPDATE media SET cv_import=$1 WHERE id=$2 AND site_id=$3",
            [JSON.stringify(result), id, media.site_id],
          );
        } else {
          await tx.query(
            "UPDATE media SET summary=$1 WHERE id=$2 AND site_id=$3",
            [
              JSON.stringify({
                ...result,
                model: browserModel,
                source: "browser-submitted",
                generatedAt: new Date().toISOString(),
              }),
              id,
              media.site_id,
            ],
          );
        }
        await audit(
          user.id,
          media.site_id,
          "ai.browser_proposal_saved",
          { mediaId: id, task: input.task, configuredModel: browserModel },
          tx,
        );
      });
      return json({ ok: true });
    }
    if (path.length === 3 && path[2] === "cv-import" && method === "POST") {
      requireAdmin(user);
      invariant(
        aiConfig().server,
        503,
        "Configure Gemini or OpenAI and its model on the server before importing a CV.",
      );
      invariant(
        media.mime === "application/pdf",
        400,
        "CV import requires a PDF. Export Word documents to PDF first.",
      );
      await rateLimit(`cv-import:${user.id}`, 10, 3600);
      const jobId = randomUUID();
      await database.query(
        "INSERT INTO jobs(id,site_id,kind,payload) VALUES($1,$2,'cv-import',$3)",
        [jobId, media.site_id, JSON.stringify({ mediaId: id })],
      );
      await audit(user.id, media.site_id, "cv.import.requested", {
        mediaId: id,
        jobId,
      });
      return json({ jobId }, 202);
    }
    if (path.length === 2 && method === "GET") {
      const file = await getObject(media.storage_key);
      invariant(file, 404, "File not found.");
      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type": media.mime,
          "Content-Length": String(file.length),
          "Content-Disposition": `${media.mime === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(media.filename)}`,
          "Cache-Control": "private, no-store",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    if (path.length === 2 && method === "DELETE") {
      requireAdmin(user);
      const site = await getSite(user, media.site_id);
      invariant(
        !collectAssetIds(site.draft).includes(id),
        409,
        "Remove this file from the current draft before deleting it.",
      );
      await database.query("DELETE FROM media WHERE id=$1", [id]);
      await deleteObject(media.storage_key);
      await audit(user.id, media.site_id, "media.deleted", { mediaId: id });
      return json({ ok: true });
    }
    if (path[2] === "abstract" && method === "POST") {
      requireAdmin(user);
      invariant(
        aiConfig().server,
        503,
        "Configure Gemini or OpenAI and its model on the server before generating summaries.",
      );
      invariant(
        media.mime === "application/pdf",
        400,
        "Abstract generation requires a PDF.",
      );
      await rateLimit(`abstract:${user.id}`, 20, 3600);
      const jobId = randomUUID();
      await database.query(
        "INSERT INTO jobs(id,site_id,kind,payload) VALUES($1,$2,'abstract',$3)",
        [jobId, media.site_id, JSON.stringify({ mediaId: id })],
      );
      return json({ jobId }, 202);
    }
  }

  return null;
}
