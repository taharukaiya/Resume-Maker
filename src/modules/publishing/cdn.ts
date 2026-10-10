import type { Sql } from "@/lib/db";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";
import type { ReleaseManifest } from "./service";
export async function syncCustomDomains(
  sql: Sql,
  siteId: string,
  manifest: ReleaseManifest | null,
) {
  const domains = await sql.query<{ distribution_id: string }>(
    "SELECT distribution_id FROM domains WHERE site_id=$1 AND distribution_id IS NOT NULL AND activated_at IS NOT NULL",
    [siteId],
  );
  if (!domains.length) return;
  const client = new CloudFrontClient({});
  for (const domain of domains) {
    const result = await client.send(
      new GetDistributionConfigCommand({ Id: domain.distribution_id }),
    );
    const settings = result.DistributionConfig;
    if (!settings?.Origins?.Items?.[0] || !result.ETag)
      throw new Error("The domain distribution configuration is unavailable.");
    settings.Enabled = !!manifest;
    if (manifest)
      settings.Origins.Items[0].OriginPath = `/releases/${siteId}/${manifest.releaseId}`;
    await client.send(
      new UpdateDistributionCommand({
        Id: domain.distribution_id,
        IfMatch: result.ETag,
        DistributionConfig: settings,
      }),
    );
    await client.send(
      new CreateInvalidationCommand({
        DistributionId: domain.distribution_id,
        InvalidationBatch: {
          CallerReference: `${Date.now()}-${manifest?.releaseId || "offline"}`,
          Paths: { Quantity: 1, Items: ["/*"] },
        },
      }),
    );
  }
}
