/** Run only in the disposable acceptance stack; never against the live database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { NextRequest } from "next/server";
import { db, closeDb } from "../src/lib/db";
import { config, assertProductionConfig } from "../src/lib/config";
import { handle } from "../src/modules/api/router";
import { scanFile } from "../src/modules/media/service";
import { articleContent } from "../src/modules/media/article-content";
import { emptyEntry } from "../src/modules/portfolios/schema";
import { processOneJob } from "../src/modules/jobs/worker";
import { getObject } from "../src/lib/storage";
import { PDFParse } from "pdf-parse";
import { aiConfig } from "../src/modules/ai/config";

assert.equal(process.env.ACCEPTANCE_TEST_ONLY, "yes");
assert.equal(
  new URL(process.env.DATABASE_URL!).pathname,
  "/brilliancy_acceptance",
);
assert.equal(config().appUrl, "https://acceptance.invalid");
assert.equal(config().dataDir, "/acceptance-data");
assertProductionConfig();
const database = await db();
const results: Record<string, unknown> = {};
let cookie = "";
async function api(route: string, method = "GET", input?: unknown) {
  const headers: Record<string, string> = { origin: config().appUrl, cookie };
  if (input && !(input instanceof FormData))
    headers["content-type"] = "application/json";
  const response = await handle(
    new NextRequest(`${config().appUrl}/api/${route}`, {
      method,
      headers,
      ...(input
        ? { body: input instanceof FormData ? input : JSON.stringify(input) }
        : {}),
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
try {
  assert.equal(
    (await database.query("SELECT id FROM sites LIMIT 1")).length,
    0,
    "Use a fresh acceptance database",
  );
  const password = `Acceptance-${randomUUID()}!`;
  await api("setup", "POST", {
    token: process.env.SETUP_TOKEN,
    name: "Acceptance Admin",
    email: "acceptance@example.test",
    password,
    agencyName: "Brilliancy Research",
  });
  const login = await api("auth/login", "POST", {
    email: "acceptance@example.test",
    password,
  });
  cookie = login.response.headers.get("set-cookie")!.split(";")[0];
  assert.match(login.response.headers.get("set-cookie")!, /Secure/i);
  await scanFile(Buffer.from("Harmless scanner acceptance test"));
  const eicar = Buffer.from(
    [
      "X5O!P%@AP[4\\PZX54(P^)7CC)7}",
      "$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
    ].join(""),
  );
  await assert.rejects(scanFile(eicar), /did not pass malware scanning/);
  results.scanner = "Clean content accepted; standard EICAR test rejected";

  const { id } = (
    await api("sites", "POST", {
      name: "Acceptance Researcher",
      slug: "acceptance-researcher",
    })
  ).data;
  const entries = [];
  for (const filename of [
    "article-paragraphs.pdf",
    "article-acceptance.docx",
  ]) {
    const form = new FormData();
    form.set("purpose", "article");
    form.set(
      "file",
      new File([await readFile(`/fixtures/${filename}`)], filename),
    );
    const upload = (await api(`sites/${id}/media`, "POST", form)).data;
    if (upload.summaryQueued) {
      await processOneJob();
      const [job] = await database.query<{ status: string; error: string }>(
        "SELECT status,error FROM jobs WHERE site_id=$1 AND payload->>'mediaId'=$2 ORDER BY created_at DESC LIMIT 1",
        [id, upload.id],
      );
      assert.equal(
        job.status,
        "done",
        `Live AI extraction failed: ${job.error}`,
      );
    }
    const state = (await api(`sites/${id}`)).data;
    const media = state.media.find((m: { id: string }) => m.id === upload.id);
    assert.ok(
      media.extracted_text?.length > 100,
      `${filename}: missing extracted body`,
    );
    assert.ok(
      media.article_assets.imageIds.length > 0,
      `${filename}: missing image`,
    );
    assert.equal(
      state.site.published_release_id,
      null,
      "Upload must not publish",
    );
    assert.equal(
      state.site.draft.sections.flatMap(
        (s: { entries: unknown[] }) => s.entries,
      ).length,
      0,
      "Extraction must not overwrite the draft",
    );
    const metadata = media.article_metadata;
    assert.equal(metadata.date, "2025-02-09");
    assert.match(metadata.authors, /Alex Example/);
    assert.match(metadata.authors, /Jamie Example/);
    assert.ok(metadata.abstract.length > 60);
    assert.equal(metadata.abstractSource, "original");
    const content = articleContent(media.extracted_text, {
      title: metadata?.title,
      authors: metadata?.authors,
      abstract: metadata?.abstract,
    });
    assert.doesNotMatch(content.body, /about:blank|--\s*\d+ of \d+\s*--/i);
    if (filename.endsWith(".pdf")) {
      assert.equal(media.article_assets.imageIds.length, 2);
      assert.deepEqual(Object.values(media.article_assets.captions), [
        "Figure 1. Synthetic verification chart.",
        "Figure 2. Synthetic verification chart.",
      ]);
    }
    const figureId = media.article_assets.imageIds[0];
    entries.push({
      ...emptyEntry(),
      title: `Reviewed ${filename}`,
      authors: "Acceptance Author",
      start: "2025-02-09",
      body:
        metadata?.abstract ||
        "A reviewed abstract for this synthetic acceptance article.",
      fullText: content.body,
      mediaId: media.id,
      coverId: figureId,
      images: [
        {
          mediaId: figureId,
          alt: "Synthetic chart",
          caption: `Reviewed caption for ${filename}`,
        },
      ],
    });
    results[filename] = {
      images: media.article_assets.imageIds.length,
      textCharacters: media.extracted_text.length,
      warnings: media.article_assets.warnings,
      metadata: {
        authors: metadata?.authors,
        date: metadata?.date,
        abstractPresent: !!metadata?.abstract,
      },
    };
  }
  results.ai = aiConfig().server
    ? "Live provider extraction completed for PDF and DOCX; original abstract retained"
    : "Not configured in this isolated run; labeled metadata tested only";
  const state = (await api(`sites/${id}`)).data;
  const document = state.site.draft;
  document.profile.bio =
    "Synthetic production acceptance portfolio. No real client information.";
  document.profile.headline = "Research acceptance test";
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
          subtitle: "Test University",
          start: "2020",
          end: "2022",
        },
      ],
    },
    {
      id: randomUUID(),
      type: "articles",
      title: "Articles",
      visible: true,
      intro: "",
      entries,
    },
  ];
  await api(`sites/${id}`, "PUT", { revision: state.site.revision, document });
  const reviewed = (await api(`sites/${id}`)).data;
  assert.equal(
    reviewed.site.draft.sections[1].entries[0].images[0].caption,
    entries[0].images[0].caption,
  );
  assert.equal(reviewed.site.published_release_id, null);
  const queued = (
    await api(`sites/${id}/publish`, "POST", {
      revision: reviewed.site.revision,
    })
  ).data;
  // Simulate a dead worker lease and prove the queued publication is recovered.
  await database.query(
    "UPDATE jobs SET status='running',locked_at=now()-interval '6 minutes',lease_id=$1 WHERE id=$2",
    [randomUUID(), queued.jobId],
  );
  await processOneJob();
  const published = (await api(`sites/${id}`)).data;
  assert.ok(published.site.published_release_id, "Publication did not recover");
  results.workerRecovery = "Expired lease recovered and publication completed";
  const [release] = await database.query<{
    manifest: { routes: Record<string, { key: string; type: string }> };
  }>("SELECT manifest FROM releases WHERE id=$1", [
    published.site.published_release_id,
  ]);
  await mkdir("/acceptance-data/evidence", { recursive: true });
  let pdfs = 0;
  let articles = 0;
  for (const [route, object] of Object.entries(release.manifest.routes)) {
    const bytes = await getObject(object.key);
    assert.ok(bytes, `Missing release object: ${route}`);
    if (object.type.startsWith("text/html") && route.startsWith("article/")) {
      const html = bytes.toString();
      assert.match(html, /Reviewed caption/);
      assert.match(html, /class="abstract article-text"/);
      await writeFile(`/acceptance-data/evidence/article-${++articles}.html`, html);
    }
    if (route.endsWith(".pdf") && !route.startsWith("assets/")) {
      const parser = new PDFParse({ data: bytes });
      try {
        const { text } = await parser.getText();
        assert.match(text, /Reviewed caption/);
        assert.doesNotMatch(text, /about:blank|CITE THIS ARTICLE/i);
      } finally {
        await parser.destroy();
      }
      await writeFile(`/acceptance-data/evidence/article-${++pdfs}.pdf`, bytes);
    }
  }
  assert.equal(pdfs, 2);
  assert.equal(articles, 2);
  results.websiteAndPdf =
    "Both upload formats reviewed, published, captions retained, clean generated PDF text and all release assets readable";

  // Seed only this isolated database. Keep work serial so the shared VPS is not flooded.
  const scaled = structuredClone(document);
  scaled.sections[1].entries = Array.from({ length: 201 }, (_, i) => ({
    ...emptyEntry(),
    id: randomUUID(),
    title: `Synthetic research article ${i + 1}`,
    authors: "Load Test Author",
    body: "Synthetic abstract. ".repeat(30),
    fullText:
      "Methods\n\n" + "Synthetic evidence and limitations. ".repeat(100),
  }));
  const json = JSON.stringify(scaled);
  for (let n = 1; n < 400; n++)
    await database.query(
      "INSERT INTO sites(id,name,slug,draft) VALUES($1,$2,$3,$4)",
      [randomUUID(), `Acceptance ${n}`, `acceptance-${n}`, json],
    );
  const timings: number[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next++ < 40) {
        const start = performance.now();
        const response = await fetch("http://127.0.0.1:3000/api/sites", {
          headers: { cookie },
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).sites.length, 400);
        timings.push(performance.now() - start);
      }
    }),
  );
  timings.sort((a, b) => a - b);
  results.scale = {
    portfolios: 400,
    seededArticles: 399 * 201 + 2,
    requests: timings.length,
    concurrency: 4,
    p95Milliseconds: Math.round(timings[Math.ceil(timings.length * 0.95) - 1]),
    scope:
      "Portfolio listing, not 400 simultaneous users or realistic stored PDF volume",
  };
  await writeFile(
    "/acceptance-data/evidence/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await closeDb();
}
