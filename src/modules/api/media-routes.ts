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
        process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL,
        503,
        "Connect an OpenAI API account and choose a model before generating summaries.",
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
