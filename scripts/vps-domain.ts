import "dotenv/config";
import { closeDb, db } from "../src/lib/db";
import { config } from "../src/lib/config";

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
    verified_at: string | null;
  }>("SELECT id,verified_at FROM domains WHERE hostname=$1", [hostname]);
  if (!domain?.verified_at)
    throw new Error(
      "Add this domain in the editor and verify its TXT record first.",
    );
  if (action === "config") {
    console.log(`${hostname} {
    encode zstd gzip
    @read method GET HEAD
    handle @read {
        rewrite * /website/${hostname}{uri}
        reverse_proxy web:3000 {
            header_up -Cookie
            header_down -Set-Cookie
        }
    }
    handle {
        respond "Method not allowed." 405
    }
}`);
  } else {
    await database.query(
      `UPDATE domains SET activated_at=${action === "activate" ? "now()" : "NULL"} WHERE id=$1`,
      [domain.id],
    );
    console.log(
      action === "activate"
        ? "Domain activated. Republish the portfolio, then verify HTTPS, pages and the contact form."
        : "Domain deactivated. Republish to return to the shared address.",
    );
  }
} finally {
  await closeDb();
}
