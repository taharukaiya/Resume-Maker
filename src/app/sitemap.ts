import { config } from "@/lib/config";
import { db } from "@/lib/db";
import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sites = await (
    await db()
  ).query<{
    slug: string;
    document: {
      seo: { indexable: boolean };
      pages: { slug: string }[];
      sections: { visible: boolean; type: string; entries: { id: string }[] }[];
    };
  }>(
    "SELECT s.slug,r.document FROM sites s JOIN releases r ON r.id=s.published_release_id",
  );
  return sites
    .filter((s) => s.document.seo.indexable)
    .flatMap((s) => {
      const base = `${config().appUrl}/portfolio/${s.slug}`;
      return [
        { url: base },
        ...s.document.pages.map((p) => ({ url: `${base}/${p.slug}` })),
        ...s.document.sections
          .filter(
            (section) => section.visible && section.type === "publications",
          )
          .flatMap((section) =>
            section.entries.map((entry) => ({
              url: `${base}/publications/${entry.id}`,
            })),
          ),
      ];
    });
}
