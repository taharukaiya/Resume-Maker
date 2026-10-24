import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/db";
import { invariant } from "@/lib/errors";
import type { PortfolioDocument } from "./schema";

/** Host-only finalization after DNS/TLS checks. Publishes only reviewed content. */
export async function finishDomainLaunch(database: Database, domainId: string) {
  return database.transaction(async (tx) => {
    const [domain] = await tx.query<{
      site_id: string;
      hostname: string;
      verified_at: string;
      activated_at: string;
    }>("SELECT * FROM domains WHERE id=$1 AND redirect_to IS NULL", [domainId]);
    invariant(
      domain?.verified_at && domain.activated_at,
      409,
      "Domain HTTPS must be connected first.",
    );
    const [site] = await tx.query<{
      id: string;
      revision: number;
      slug: string;
      published_release_id: string;
    }>("SELECT * FROM sites WHERE id=$1 FOR UPDATE", [domain.site_id]);
    const [request] = await tx.query<{
      value: {
        revision: number;
        reviewedReleaseId: string;
        status: string;
        jobId?: string;
      };
    }>("SELECT value FROM settings WHERE key=$1 FOR UPDATE", [
      `vps.domain.request.${domainId}`,
    ]);
    invariant(
      request && ["connecting", "publishing"].includes(request.value.status),
      409,
      "No approved domain launch is pending.",
    );
    if (request.value.jobId) return request.value.jobId;
    invariant(
      site.revision === request.value.revision &&
        site.published_release_id === request.value.reviewedReleaseId,
      409,
      "Portfolio changed. Review it before requesting Go live again.",
    );
    const running = await tx.query(
      "SELECT id FROM jobs WHERE site_id=$1 AND kind='publish' AND status IN ('queued','running')",
      [site.id],
    );
    invariant(!running.length, 409, "Another publication is running.");
    const [release] = await tx.query<{ document: PortfolioDocument }>(
      "SELECT document FROM releases WHERE id=$1 AND site_id=$2 AND revision=$3",
      [site.published_release_id, site.id, site.revision],
    );
    invariant(release, 409, "Reviewed publication is missing.");
    const [agency] = await tx.query<{ value: { name: string } }>(
      "SELECT value FROM settings WHERE key='agency'",
    );
    const jobId = randomUUID();
    await tx.query("UPDATE domains SET is_primary=false WHERE site_id=$1", [
      site.id,
    ]);
    await tx.query("UPDATE domains SET is_primary=true WHERE id=$1", [
      domainId,
    ]);
    await tx.query(
      "INSERT INTO jobs(id,site_id,kind,payload) VALUES($1,$2,'publish',$3)",
      [
        jobId,
        site.id,
        JSON.stringify({
          document: release.document,
          revision: site.revision,
          slug: site.slug,
          agencyName: agency?.value.name || "Brilliancy Research",
          canonicalUrl: `https://${domain.hostname}`,
        }),
      ],
    );
    await tx.query(
      "UPDATE settings SET value=value || $2::jsonb WHERE key=$1",
      [
        `vps.domain.request.${domainId}`,
        JSON.stringify({
          status: "publishing",
          jobId,
          message:
            "HTTPS connected. Publishing the reviewed portfolio at its new address.",
        }),
      ],
    );
    return jobId;
  });
}
