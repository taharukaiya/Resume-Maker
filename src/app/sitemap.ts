import { config } from "@/lib/config";
import { db } from "@/lib/db";
import type { MetadataRoute } from "next";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
import type { ReleaseManifest } from "@/modules/publishing/service";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sites = await (
    await db()
  ).query<{
    slug: string;
    document: PortfolioDocument;
    manifest: ReleaseManifest;
  }>(
    "SELECT s.slug,r.document,r.manifest FROM sites s JOIN releases r ON r.id=s.published_release_id",
  );
  return sites
    .filter((s) => s.document.seo.indexable)
    .flatMap((s) => {
      const base = `${config().appUrl}/portfolio/${s.slug}`;
      return Object.keys(s.manifest.routes)
        .filter(
          (route) => route === "index.html" || route.endsWith("/index.html"),
        )
        .map((route) => ({
          url:
            route === "index.html"
              ? base
              : `${base}/${route.replace(/\/index\.html$/, "")}`,
        }));
    });
}
