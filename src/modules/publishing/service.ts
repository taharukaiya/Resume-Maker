import { readFile } from "node:fs/promises";
import path from "node:path";
import { selectedFonts, fonts } from "@/modules/portfolios/design";
import { config } from "@/lib/config";
import { db, type Sql } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { getObject, putObject } from "@/lib/storage";
import type { Media } from "@/modules/media/service";
import {
  collectAssetIds,
  documentSchema,
  type PortfolioDocument,
} from "@/modules/portfolios/schema";
import { randomUUID } from "node:crypto";
import { syncCustomDomains } from "./cdn";
import { renderPortfolio } from "./render";
import sharp from "sharp";
import { shibaDocument } from "./shiba";
import { shibaScriptSource } from "./shiba-script";
export type ReleaseManifest = {
  scriptSource?: string;
  siteId: string;
  releaseId: string;
  slug: string;
  revision: number;
  baseUrl: string;
  routes: Record<string, { key: string; type: string }>;
};
export type PublishPayload = {
  document: PortfolioDocument;
  revision: number;
  slug: string;
  agencyName: string;
  canonicalUrl: string;
};
export async function buildRelease(
  siteId: string,
  payload: PublishPayload,
  releaseId: string = randomUUID(),
): Promise<ReleaseManifest> {
  const document = shibaDocument(documentSchema.parse(payload.document)),
    database = await db();
  const assets = collectAssetIds({
    ...document,
    sections: document.sections.filter(
      (section) =>
        section.visible &&
        (document.navigation.articlesEnabled !== false ||
          section.type !== "publications"),
    ),
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.filter(
        (section) =>
          section.visible &&
          (document.navigation.articlesEnabled !== false ||
            section.type !== "publications"),
      ),
    })),
  });
  const media = await database.query<Media>(
    "SELECT * FROM media WHERE site_id=$1",
    [siteId],
  );
  const routes: ReleaseManifest["routes"] = {};
  const assetPaths = new Map<string, string>();
  let faviconUrl: string | undefined;
  for (const id of assets) {
    const file = media.find((m) => m.id === id);
    invariant(file, 400, "A referenced file no longer exists.");
    const bytes = await getObject(file.storage_key);
    invariant(bytes, 500, "A referenced file could not be read.");
    const ext = file.mime === "application/pdf" ? "pdf" : "webp";
    const route = `assets/${id}.${ext}`,
      key = `releases/${siteId}/${releaseId}/${route}`;
    await putObject(key, bytes, file.mime);
    routes[route] = { key, type: file.mime };
    if (id === document.profile.portraitId && file.mime.startsWith("image/")) {
      const iconKey = `releases/${siteId}/${releaseId}/favicon.png`;
      const icon = await sharp(bytes)
        .rotate()
        .resize(64, 64, { fit: "cover", position: "attention" })
        .png()
        .toBuffer();
      await putObject(iconKey, icon, "image/png");
      routes["favicon.png"] = { key: iconKey, type: "image/png" };
      faviconUrl = `${payload.canonicalUrl}/favicon.png?v=${releaseId}`;
    }
    assetPaths.set(
      id,
      config().assetUrl
        ? `${config().assetUrl!.replace(/\/$/, "")}/${key}`
        : `${config().appUrl}/portfolio/${payload.slug}/${route}`,
    );
  }
  for (const fontId of selectedFonts(document.theme)) {
    const file = fonts[fontId].file!;
    const route = `fonts/${file}`,
      key = `releases/${siteId}/${releaseId}/${route}`;
    await putObject(
      key,
      await readFile(path.join(process.cwd(), "public", "fonts", file)),
      "font/woff2",
    );
    routes[route] = { key, type: "font/woff2" };
  }
  const rendered = renderPortfolio(document, {
    faviconUrl,
    baseUrl: payload.canonicalUrl,
    agencyName: payload.agencyName,
    asset: (id) => assetPaths.get(id) || "",
    isImage: (id) =>
      !!media.find((file) => file.id === id)?.mime.startsWith("image/"),
    siteId,
    appUrl: config().appUrl,
  });
  for (const [route, html] of Object.entries(rendered)) {
    const key = `releases/${siteId}/${releaseId}/${route}`,
      type = route.endsWith(".svg")
        ? "image/svg+xml"
        : route.endsWith(".xml")
          ? "application/xml; charset=utf-8"
          : route.endsWith(".txt")
            ? "text/plain; charset=utf-8"
            : "text/html; charset=utf-8";
    await putObject(key, html, type);
    routes[route] = { key, type };
  }
  return {
    scriptSource: shibaScriptSource,
    siteId,
    releaseId,
    slug: payload.slug,
    revision: payload.revision,
    baseUrl: payload.canonicalUrl,
    routes,
  };
}
export async function activateRelease(
  tx: Sql,
  manifest: ReleaseManifest,
  document: PortfolioDocument,
) {
  await tx.query("SELECT id FROM sites WHERE id=$1 FOR UPDATE", [
    manifest.siteId,
  ]);
  await syncCustomDomains(tx, manifest.siteId, manifest);
  await tx.query(
    "INSERT INTO releases(id,site_id,revision,document,manifest) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
    [
      manifest.releaseId,
      manifest.siteId,
      manifest.revision,
      JSON.stringify(document),
      JSON.stringify(manifest),
    ],
  );
  await putObject(
    `sites/${manifest.slug}/live.json`,
    JSON.stringify(manifest),
    "application/json",
    tx,
  );
  await tx.query(
    "UPDATE sites SET published_release_id=$1,status=CASE WHEN revision=$2 THEN 'published' ELSE 'draft' END WHERE id=$3",
    [manifest.releaseId, manifest.revision, manifest.siteId],
  );
  const keep = Number(process.env.RELEASE_RETENTION || 0);
  if (Number.isInteger(keep) && keep >= 3) {
    // Keep the current publication plus the newest remaining releases. Cleanup
    // is durable and retried; saved editing revisions are unaffected.
    const expired = await tx.query<{ id: string }>(
      "SELECT id FROM releases WHERE site_id=$1 AND id<>$2 ORDER BY created_at DESC,id DESC OFFSET $3",
      [manifest.siteId, manifest.releaseId, keep - 1],
    );
    for (const release of expired) {
      await tx.query(
        "INSERT INTO storage_cleanup(prefix) VALUES($1) ON CONFLICT DO NOTHING",
        [`releases/${manifest.siteId}/${release.id}/`],
      );
      await tx.query("DELETE FROM releases WHERE id=$1 AND site_id=$2", [
        release.id,
        manifest.siteId,
      ]);
    }
  }
}
export async function liveManifest(
  slug: string,
): Promise<ReleaseManifest | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (config().vps) {
    // On a single VPS, the committed database publication is authoritative.
    // A filesystem write cannot be rolled back with a PostgreSQL transaction.
    const [release] = await (
      await db()
    ).query<{ manifest: ReleaseManifest }>(
      "SELECT r.manifest FROM sites s JOIN releases r ON r.id=s.published_release_id AND r.site_id=s.id WHERE s.slug=$1",
      [slug],
    );
    return release?.manifest || null;
  }
  const bytes = await getObject(`sites/${slug}/live.json`);
  return bytes ? JSON.parse(bytes.toString()) : null;
}
