/** Synthetic local baseline. Never reads .env or contacts a remote application. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";

assert.equal(
  process.argv[2],
  "--isolated",
  "Pass --isolated to create disposable local test data",
);
for (const key of [
  "DATABASE_URL",
  "DATABASE_SECRET_ARN",
  "S3_BUCKET",
  "PUBLIC_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_PROFILE",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
])
  assert.ok(!process.env[key], `Remove ${key} from this test process first`);
const directory = path.resolve(".test-data", `capacity-${Date.now()}`);
Object.assign(process.env, {
  NODE_ENV: "test",
  DEPLOYMENT_MODE: "",
  DATA_DIR: directory,
  APP_URL: "http://capacity.invalid",
  PUBLIC_ASSET_URL: "",
  SESSION_SECRET: randomUUID() + randomUUID(),
  SETUP_TOKEN: randomUUID(),
  AI_PROVIDER: "none",
  RELEASE_RETENTION: "3",
});
await mkdir(directory, { recursive: true });
const { db, closeDb } = await import("../src/lib/db");
const { handle } = await import("../src/modules/api/router");
const { NextRequest } = await import("next/server");
const { emptyDocument, emptyEntry } =
  await import("../src/modules/portfolios/schema");
const { processOneJob } = await import("../src/modules/jobs/worker");
const { getObject } = await import("../src/lib/storage");
let cookie = "";
async function api(route: string, method = "GET", input?: unknown) {
  const response = await handle(
    new NextRequest(`http://capacity.invalid/api/${route}`, {
      method,
      headers: {
        origin: "http://capacity.invalid",
        cookie,
        "content-type": "application/json",
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    }),
    route.split("/"),
  );
  const data = await response.json();
  assert.ok(
    response.ok,
    `${method} ${route}: ${response.status} ${JSON.stringify(data)}`,
  );
  return { response, data };
}
const results: Record<string, unknown> = {
  scope:
    "Local in-process API and real publication baseline using embedded PostgreSQL; not an HTTP/VPS capacity certification. No production credentials or network requests.",
  host: {
    platform: os.platform(),
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 2 ** 30),
  },
  portfolios: 400,
  articlesPerPortfolio: 220,
  articles: 88000,
};
let peakRss = 0;
const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 100);
async function measure(
  label: string,
  count: number,
  concurrency: number,
  operation: (i: number) => Promise<void>,
) {
  let next = 0;
  const durations: number[] = [];
  const start = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < count) {
        const index = next++;
        const begin = performance.now();
        await operation(index);
        durations.push(performance.now() - begin);
      }
    }),
  );
  durations.sort((a, b) => a - b);
  results[label] = {
    operations: count,
    concurrency,
    seconds: +((performance.now() - start) / 1000).toFixed(2),
    p50Ms: Math.round(durations[Math.ceil(count * 0.5) - 1]),
    p95Ms: Math.round(durations[Math.ceil(count * 0.95) - 1]),
    maxMs: Math.round(durations.at(-1)!),
  };
  console.log(label, JSON.stringify(results[label]));
}
try {
  const database = await db();
  const password = `Synthetic-${randomUUID()}!`;
  await api("setup", "POST", {
    token: process.env.SETUP_TOKEN,
    name: "Capacity Admin",
    email: "capacity@example.test",
    password,
    agencyName: "Synthetic Capacity",
  });
  const login = await api("auth/login", "POST", {
    email: "capacity@example.test",
    password,
  });
  cookie = login.response.headers.get("set-cookie")!.split(";")[0];
  const document = emptyDocument("Synthetic Capacity Researcher");
  document.profile.bio = "Synthetic capacity fixture. Not a real researcher.";
  document.sections = [
    {
      id: randomUUID(),
      type: "education",
      title: "Education",
      visible: true,
      intro: "",
      entries: [
        {
          ...emptyEntry(),
          title: "MSc",
          subtitle: "Synthetic University",
          start: "2020",
          end: "2022",
        },
      ],
    },
    {
      id: randomUUID(),
      type: "articles",
      title: "Research",
      visible: true,
      intro: "",
      entries: Array.from({ length: 220 }, (_, i) => ({
        ...emptyEntry(),
        title: `Synthetic research article ${i + 1}`,
        authors: "Alex Example; Jamie Example",
        start: "2025-02-09",
        category: `Topic ${i % 10}`,
        body: "This synthetic abstract describes observations, methods and limitations. ".repeat(
          12,
        ),
        fullText: [
          "Introduction",
          "Methods",
          "Results",
          "Discussion",
          "Conclusion",
        ]
          .map(
            (heading) =>
              `## ${heading}\n\n` +
              Array.from(
                { length: 4 },
                (_, p) =>
                  `Observation ${p + 1} for article ${i + 1}. ` +
                  "Evidence must be evaluated alongside methodological limitations and independent replication. ".repeat(
                    8,
                  ),
              ).join("\n\n"),
          )
          .join("\n\n"),
      })),
    },
  ];
  const json = JSON.stringify(document);
  results.draftBytes = Buffer.byteLength(json);
  const ids = Array.from({ length: 400 }, () => randomUUID());
  const seedStart = performance.now();
  for (let i = 0; i < ids.length; i++) {
    await database.query(
      "INSERT INTO sites(id,name,slug,draft) VALUES($1,$2,$3,$4)",
      [ids[i], `Synthetic ${i}`, `synthetic-${i}`, json],
    );
    if (i % 100 === 99) console.log(`Seeded ${i + 1} portfolios`);
  }
  results.seedSeconds = Math.round((performance.now() - seedStart) / 1000);
  await measure("list", 80, 4, async () => {
    assert.equal((await api("sites")).data.sites.length, 400);
  });
  await measure("editorOpen", 40, 4, async (i) => {
    assert.equal(
      (await api(`sites/${ids[i]}`)).data.site.draft.sections[1].entries.length,
      220,
    );
  });
  await measure("editorSave", 8, 2, async (i) => {
    await api(`sites/${ids[i]}`, "PUT", { revision: 1, document });
  });
  const state = (await api(`sites/${ids[0]}`)).data;
  assert.equal(
    state.site.published_release_id,
    null,
    "Saving must not publish",
  );
  const { jobId } = (
    await api(`sites/${ids[0]}/publish`, "POST", {
      revision: state.site.revision,
    })
  ).data;
  await measure("publish220", 1, 1, async () => {
    await processOneJob();
  });
  const [job] = await database.query<{ status: string; error: string }>(
    "SELECT status,error FROM jobs WHERE id=$1",
    [jobId],
  );
  assert.equal(job.status, "done", job.error);
  const [release] = await database.query<{
    manifest: { routes: Record<string, { key: string; type: string }> };
  }>(
    "SELECT r.manifest FROM sites s JOIN releases r ON r.id=s.published_release_id WHERE s.id=$1",
    [ids[0]],
  );
  const objects = Object.values(release.manifest.routes);
  const pdfs = objects.filter((o) => o.type === "application/pdf");
  assert.equal(pdfs.length, 220);
  let releaseBytes = 0;
  await measure("releaseRead", objects.length, 4, async (i) => {
    const bytes = await getObject(objects[i].key);
    assert.ok(bytes?.length);
    releaseBytes += bytes.length;
  });
  results.release = {
    files: objects.length,
    pdfs: pdfs.length,
    bytes: releaseBytes,
  };
  results.peakRssMiB = Math.round(
    Math.max(peakRss, process.memoryUsage().rss) / 2 ** 20,
  );
  results.limitations = [
    "Synthetic text only; no 88,000 original documents/images stored",
    "One real 220-article publication, not 400 concurrent publications",
    "No network latency, reverse proxy, browser rendering or production PostgreSQL",
    "DOCX/PDF parsing and provider quotas require separate staging load testing",
    "Production VPS untouched",
  ];
  await writeFile(
    path.join(directory, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  console.log(`Evidence: ${directory}`);
} finally {
  clearInterval(sampler);
  await closeDb();
}
