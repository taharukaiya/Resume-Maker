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
export type ReleaseManifest = {
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
  const document = documentSchema.parse(payload.document),
    database = await db();
  const assets = collectAssetIds(document);
  const media = await database.query<Media>(
    "SELECT * FROM media WHERE site_id=$1",
    [siteId],
  );
  const routes: ReleaseManifest["routes"] = {};
  const assetPaths = new Map<string, string>();
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
    assetPaths.set(
      id,
      config().assetUrl
        ? `${config().assetUrl!.replace(/\/$/, "")}/${key}`
        : `${config().appUrl}/p/${payload.slug}/${route}`,
    );
  }
  const rendered = renderPortfolio(document, {
    baseUrl: payload.canonicalUrl,
    agencyName: payload.agencyName,
    asset: (id) => assetPaths.get(id) || "",
    siteId,
    appUrl: config().appUrl,
  });
  for (const [route, html] of Object.entries(rendered)) {
    const key = `releases/${siteId}/${releaseId}/${route}`,
      type = route.endsWith(".xml")
        ? "application/xml; charset=utf-8"
        : route.endsWith(".txt")
          ? "text/plain; charset=utf-8"
          : "text/html; charset=utf-8";
    await putObject(key, html, type);
    routes[route] = { key, type };
  }
  return {
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
  );
  await tx.query(
    "UPDATE sites SET published_release_id=$1,status=CASE WHEN revision=$2 THEN 'published' ELSE 'draft' END WHERE id=$3",
    [manifest.releaseId, manifest.revision, manifest.siteId],
  );
}
export async function liveManifest(
  slug: string,
): Promise<ReleaseManifest | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const bytes = await getObject(`sites/${slug}/live.json`);
  return bytes ? JSON.parse(bytes.toString()) : null;
}
