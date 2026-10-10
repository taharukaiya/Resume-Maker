import "dotenv/config";
import { existsSync } from "node:fs";

// Read-only: never open the embedded database in a second process or print secrets.
let failures = 0;
function check(ok: boolean, name: string, action: string) {
  console.log(`${ok ? "PASS" : "ACTION"}  ${name}${ok ? "" : ` — ${action}`}`);
  if (!ok) failures++;
}
console.log("Brilliancy Research — local readiness\n");
check(
  Number(process.versions.node.split(".")[0]) >= 22,
  "Supported Node.js",
  "Install Node.js 24 LTS.",
);
check(existsSync(".env"), "Local configuration file", "Run npm run setup.");
check(
  (process.env.SESSION_SECRET?.length || 0) >= 32,
  "Session encryption key configured",
  "Run npm run setup.",
);
check(
  !!process.env.SETUP_TOKEN,
  "Installation token configured",
  "Run npm run setup.",
);
check(
  process.env.RUN_WORKER === "true" ||
    !!process.env.DATABASE_URL ||
    !!process.env.DATABASE_SECRET_ARN,
  "Background job configuration",
  "Set RUN_WORKER=true for local embedded development, then restart npm run dev.",
);
const origin = process.env.APP_URL || "http://localhost:3000";
try {
  const url = new URL(origin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid application origin");
  const response = await fetch(`${url.origin}/api/status`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Status endpoint failed");
  const status = (await response.json()) as {
    initialized?: boolean;
    agencyName?: string;
  };
  check(
    typeof status.initialized === "boolean" &&
      status.agencyName === "Brilliancy Research",
    "Application and database respond",
    "Confirm APP_URL points to this application.",
  );
  check(
    status.initialized === true,
    "First administrator created",
    "Run npm run setup, open its private link, and create your administrator.",
  );
  console.log(`Open: ${url.origin}/login`);
} catch {
  check(
    false,
    "Application status reachable",
    "Run npm run dev in another terminal. Check APP_URL and read that terminal's errors.",
  );
}
console.log(
  "\nExternal services (configuration only; live operation is not verified):",
);
for (const [name, ready] of [
  ["AI summaries", !!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)],
  ["Amazon SES email", !!process.env.EMAIL_FROM],
  ["Amazon S3 storage", !!(process.env.S3_BUCKET && process.env.PUBLIC_BUCKET)],
  ["Upload malware scanning", !!process.env.CLAMAV_HOST],
] as const)
  console.log(`${ready ? "CONFIGURED" : "NOT CONFIGURED"}  ${name}`);
console.log(
  "\nLocal portfolios, invitations shared by link, review and publishing do not need these external accounts.",
);
console.log(
  "Next steps: docs/COMPLETION_CHECKLIST.md and docs/GETTING_STARTED.md",
);
process.exitCode = failures ? 1 : 0;
