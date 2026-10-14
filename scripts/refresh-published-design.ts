import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db, closeDb } from "../src/lib/db";
import { invariant } from "../src/lib/errors";
import { documentSchema } from "../src/modules/portfolios/schema";
import {
  buildRelease,
  activateRelease,
  type ReleaseManifest,
} from "../src/modules/publishing/service";
import { audit } from "../src/modules/auth/service";

// Re-render approved public snapshots, never unpublished drafts. Old releases
// remain available for rollback; no content, revision or domain is changed.
const database = await db();
try {
  const sites = await database.query<{
    id: string;
    slug: string;
    published_release_id: string;
    revision: number;
    document: unknown;
    manifest: ReleaseManifest;
  }>(
    "SELECT s.id,s.slug,s.published_release_id,r.revision,r.document,r.manifest FROM sites s JOIN releases r ON r.id=s.published_release_id AND r.site_id=s.id ORDER BY s.slug",
  );
  const apply = process.argv.includes("--apply");
  console.log(
    `${apply ? "Refreshing" : "Previewing"} ${sites.length} published portfolio(s). Draft content is excluded.`,
  );
  const [agency] = await database.query<{ value: { name: string } }>(
    "SELECT value FROM settings WHERE key='agency'",
  );
  for (const site of sites) {
    const document = documentSchema.parse(site.document);
    if (!apply) {
      console.log(`${site.slug}: ${site.manifest.baseUrl}`);
      continue;
    }
    const manifest = await buildRelease(
      site.id,
      {
        document,
        revision: site.revision,
        slug: site.slug,
        agencyName: agency?.value.name || "Brilliancy Research",
        canonicalUrl: site.manifest.baseUrl,
      },
      randomUUID(),
    );
    const retention = process.env.RELEASE_RETENTION;
    process.env.RELEASE_RETENTION = "0";
    try {
      await database.transaction(async (tx) => {
        const [current] = await tx.query<{
          published_release_id: string;
          status: string;
        }>(
          "SELECT published_release_id,status FROM sites WHERE id=$1 FOR UPDATE",
          [site.id],
        );
        invariant(
          current?.published_release_id === site.published_release_id,
          409,
          "This portfolio was republished during the design refresh. Retry using its latest approved snapshot.",
        );
        await activateRelease(tx, manifest, document);
        await tx.query("UPDATE sites SET status=$1 WHERE id=$2", [
          current.status,
          site.id,
        ]);
        await audit(
          null,
          site.id,
          "portfolio.design-refreshed",
          {
            previousReleaseId: site.published_release_id,
            releaseId: manifest.releaseId,
          },
          tx,
        );
      });
    } finally {
      if (retention === undefined) delete process.env.RELEASE_RETENTION;
      else process.env.RELEASE_RETENTION = retention;
    }
    console.log(
      `${site.slug}: refreshed approved content; prior release retained.`,
    );
  }
} finally {
  await closeDb();
}
