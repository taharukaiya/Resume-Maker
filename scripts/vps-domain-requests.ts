import "dotenv/config";
import { db, closeDb } from "../src/lib/db";
import { resolveTxt } from "node:dns/promises";

// Invoked only by the host reconciler. Output contains public hostnames/status,
// never credentials or verification tokens.
const [action, id, status, message] = process.argv.slice(2);
try {
  const database = await db();
  if (action === "list") {
    const rows = await database.query<{
      id: string;
      hostname: string;
      verification_token: string;
      verification_hostname: string | null;
      aliases: string[];
      status: string;
    }>(
      "SELECT d.id,d.hostname,d.verification_token,d.verification_hostname,ARRAY(SELECT a.hostname FROM domains a WHERE a.redirect_to=d.hostname AND a.site_id=d.site_id) AS aliases,s.value->>'status' AS status FROM domains d JOIN settings s ON s.key='vps.domain.request.' || d.id::text WHERE d.redirect_to IS NULL AND d.verified_at IS NOT NULL AND d.activated_at IS NULL AND s.value->>'status' IN ('queued','connecting') ORDER BY d.created_at LIMIT 10",
    );
    const output = [];
    for (const row of rows) {
      try {
        const txt = await resolveTxt(
          `_brilliancy.${row.verification_hostname || row.hostname}`,
        );
        if (!txt.some((parts) => parts.join("") === row.verification_token))
          throw new Error("Ownership record changed.");
        output.push({
          id: row.id,
          hostname: row.hostname,
          aliases: row.aliases,
          status: row.status,
        });
      } catch {
        await database.query("UPDATE settings SET value=$2 WHERE key=$1", [
          `vps.domain.request.${row.id}`,
          JSON.stringify({
            status: "error",
            message:
              "Ownership TXT record could not be verified. Restore the record and retry.",
          }),
        ]);
      }
    }
    console.log(JSON.stringify(output));
  } else if (
    action === "status" &&
    /^[a-f0-9-]{36}$/.test(id || "") &&
    ["connecting", "ready", "error"].includes(status)
  ) {
    await database.query("UPDATE settings SET value=$2 WHERE key=$1", [
      `vps.domain.request.${id}`,
      JSON.stringify({ status, message: message.slice(0, 500) }),
    ]);
  } else throw new Error("Invalid domain request command.");
} finally {
  await closeDb();
}
