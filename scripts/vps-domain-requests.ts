import "dotenv/config";
import { db, closeDb } from "../src/lib/db";
import { resolveTxt } from "node:dns/promises";
import { finishDomainLaunch } from "../src/modules/portfolios/domain-launch";

// Host-only IPC. Ownership TXT proofs are public; provider tokens never enter this process.
const [action, id, status, message] = process.argv.slice(2);
try {
  const database = await db();
  const validId = /^[a-f0-9-]{36}$/.test(id || "");
  if (action === "capabilities") {
    const input = JSON.parse(id);
    const value = {
      configured: input.configured === true,
      checkedAt: new Date().toISOString(),
      goLiveDomains: Array.isArray(input.goLiveDomains)
        ? input.goLiveDomains.filter(
            (v: unknown) => typeof v === "string" && /^[a-z0-9.-]+$/.test(v),
          )
        : [],
    };
    await database.query(
      "INSERT INTO settings(key,value) VALUES('vps.domain.automation',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [JSON.stringify(value)],
    );
  } else if (action === "prepare-list") {
    await database.query(
      "UPDATE settings SET value=value || $1::jsonb WHERE key LIKE 'vps.domain.prepare.%' AND value->>'status' IN ('preparing','awaiting_dns') AND (value->>'requestedAt')::timestamptz < now() - interval '48 hours'",
      [
        JSON.stringify({
          status: "error",
          message:
            "Ownership verification timed out. Check that Hostinger manages this domain's authoritative DNS, then retry preparation.",
        }),
      ],
    );
    console.log(
      JSON.stringify(
        await database.query(
          "SELECT d.id,d.hostname,d.verification_token,d.verification_hostname,ARRAY(SELECT a.hostname FROM domains a WHERE a.redirect_to=d.hostname AND a.site_id=d.site_id) AS aliases,s.value->>'status' AS status FROM domains d JOIN settings s ON s.key='vps.domain.prepare.' || d.id::text WHERE d.redirect_to IS NULL AND d.activated_at IS NULL AND s.value->>'status' IN ('preparing','awaiting_dns') ORDER BY d.created_at LIMIT 10",
        ),
      ),
    );
  } else if (action === "prepare-verify" && validId) {
    const [domain] = await database.query<{
      hostname: string;
      verification_hostname: string;
      verification_token: string;
      site_id: string;
    }>("SELECT * FROM domains WHERE id=$1 AND redirect_to IS NULL", [id]);
    if (!domain) throw new Error("Domain no longer exists.");
    let verified = false;
    try {
      verified = (
        await resolveTxt(
          `_brilliancy.${domain.verification_hostname || domain.hostname}`,
        )
      ).some((parts) => parts.join("") === domain.verification_token);
    } catch {
      /* DNS propagation is asynchronous. */
    }
    await database.transaction(async (tx) => {
      await tx.query("SELECT id FROM sites WHERE id=$1 FOR UPDATE", [
        domain.site_id,
      ]);
      if (verified)
        await tx.query(
          "UPDATE domains SET verified_at=now() WHERE site_id=$1 AND (id=$2 OR redirect_to=$3) AND verification_token=$4",
          [domain.site_id, id, domain.hostname, domain.verification_token],
        );
      await tx.query(
        "UPDATE settings SET value=value || $2::jsonb WHERE key=$1",
        [
          `vps.domain.prepare.${id}`,
          JSON.stringify({
            status: verified ? "prepared" : "awaiting_dns",
            message: verified
              ? "Ownership verified. Domain prepared; website and email routing are unchanged."
              : "Ownership TXT added. Waiting for DNS verification; checking automatically.",
          }),
        ],
      );
    });
  } else if (
    ["status", "prepare-status"].includes(action) &&
    validId &&
    (action === "prepare-status"
      ? ["error", "purchase_required", "dns_setup_required"]
      : ["dns_pending", "connecting", "ready", "error"]
    ).includes(status)
  ) {
    await database.query(
      "UPDATE settings SET value=value || $2::jsonb WHERE key=$1",
      [
        `vps.domain.${action === "prepare-status" ? "prepare" : "request"}.${id}`,
        JSON.stringify({ status, message: message.slice(0, 500) }),
      ],
    );
  } else if (action === "finish" && validId) {
    await finishDomainLaunch(database, id);
  } else if (action === "list") {
    const rows = await database.query<{
      id: string;
      hostname: string;
      verification_token: string;
      verification_hostname: string;
      aliases: string[];
      status: string;
      request: { revision: number; reviewedReleaseId: string; jobId?: string };
      revision: number;
      published_release_id: string;
    }>(
      "SELECT d.id,d.hostname,d.verification_token,d.verification_hostname,ARRAY(SELECT a.hostname FROM domains a WHERE a.redirect_to=d.hostname AND a.site_id=d.site_id) AS aliases,s.value->>'status' AS status,s.value AS request,p.revision,p.published_release_id FROM domains d JOIN sites p ON p.id=d.site_id JOIN settings s ON s.key='vps.domain.request.' || d.id::text WHERE d.redirect_to IS NULL AND d.verified_at IS NOT NULL AND s.value->>'status' IN ('queued','dns_pending','connecting','publishing') ORDER BY d.created_at LIMIT 10",
    );
    const output = [];
    for (const row of rows) {
      try {
        if (row.status === "publishing") {
          const [job] = await database.query<{ status: string }>(
            "SELECT status FROM jobs WHERE id=$1",
            [row.request.jobId],
          );
          if (job && ["done", "failed"].includes(job.status))
            await database.query(
              "UPDATE settings SET value=value || $2::jsonb WHERE key=$1",
              [
                `vps.domain.request.${row.id}`,
                JSON.stringify({
                  status: job.status === "done" ? "ready" : "error",
                  message:
                    job.status === "done"
                      ? "Your reviewed portfolio is live with HTTPS at its www address."
                      : "Publication failed. Review publication status before retrying; the previous release is retained.",
                }),
              ],
            );
          continue;
        }
        if (process.env.DOMAIN_GO_LIVE_ENABLED !== "true") continue;
        if (
          row.request.revision !== row.revision ||
          row.request.reviewedReleaseId !== row.published_release_id
        )
          throw new Error("Portfolio changed.");
        const txt = await resolveTxt(
          `_brilliancy.${row.verification_hostname || row.hostname}`,
        );
        if (!txt.some((parts) => parts.join("") === row.verification_token))
          throw new Error("Ownership record changed.");
        const { verification_token: _proof, request: _request, ...safe } = row;
        output.push(safe);
      } catch {
        await database.query(
          "UPDATE settings SET value=value || $2::jsonb WHERE key=$1",
          [
            `vps.domain.request.${row.id}`,
            JSON.stringify({
              status: "error",
              message:
                "Ownership or the reviewed portfolio changed. Verify ownership and review the latest publication before retrying.",
            }),
          ],
        );
      }
    }
    console.log(JSON.stringify(output));
  } else throw new Error("Invalid domain request command.");
} finally {
  await closeDb();
}
