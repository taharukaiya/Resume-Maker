import "dotenv/config";
import { closeDb, db } from "../src/lib/db";
import { config } from "../src/lib/config";
import { vpsDomainConfig } from "../src/lib/vps-domain-config";

// Operator-only: invoked over SSH; never exposes a remote configuration endpoint.
const [action, hostname] = process.argv.slice(2);
if (
  !config().vps ||
  !["config", "activate", "deactivate"].includes(action) ||
  !hostname ||
  !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    hostname,
  )
)
  throw new Error(
    "Usage (VPS mode): vps-domain.ts config|activate|deactivate hostname",
  );
try {
  const database = await db();
  const [domain] = await database.query<{
    id: string;
    site_id: string;
    verified_at: string | null;
  }>("SELECT id,site_id,verified_at FROM domains WHERE hostname=$1", [
    hostname,
  ]);
  if (!domain?.verified_at)
    throw new Error(
      "Add this domain in the editor and verify its TXT record first.",
    );
  if (action === "config") {
    console.log(
      vpsDomainConfig(hostname, process.env.VPS_PROXY_MODE === "existing"),
    );
  } else {
    await database.transaction(async (tx) => {
      const [site] = await tx.query(
        "SELECT id FROM sites WHERE id=$1 FOR UPDATE",
        [domain.site_id],
      );
      if (!site) throw new Error("This portfolio no longer exists.");
      const running = await tx.query(
        "SELECT id FROM jobs WHERE site_id=$1 AND kind='publish' AND status IN ('queued','running') LIMIT 1",
        [domain.site_id],
      );
      if (running.length)
        throw new Error(
          "Wait for publishing to finish before changing the website address.",
        );
      const [current] = await tx.query<{ verified_at: string | null }>(
        "SELECT verified_at FROM domains WHERE id=$1 AND site_id=$2 FOR UPDATE",
        [domain.id, domain.site_id],
      );
      if (!current?.verified_at)
        throw new Error(
          "This domain must still be registered and TXT-verified.",
        );
      await tx.query(
        action === "activate"
          ? "UPDATE domains SET activated_at=now() WHERE id=$1"
          : "UPDATE domains SET activated_at=NULL,is_primary=false WHERE id=$1",
        [domain.id],
      );
    });
    console.log(
      action === "activate"
        ? "Domain activated for delivery. Verify its DNS, HTTPS and public pages, then have an administrator select it under Website address and republish. Activation alone does not select the portfolio's website address."
        : "Domain deactivated and its primary selection cleared. Have an administrator select the shared address or another connected domain under Website address and republish. Remove only this domain's external proxy route when retiring it.",
    );
  }
} finally {
  await closeDb();
}
