import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
const { parseCv } = vi.hoisted(() => ({ parseCv: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: parseCv };
  },
}));
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rm } from "node:fs/promises";
import { handle } from "../src/modules/api/router";
import { db, closeDb } from "../src/lib/db";
import { hash } from "../src/lib/crypto";
import {
  emptyEntry,
  emptyDocument,
  type PortfolioDocument,
} from "../src/modules/portfolios/schema";
import { processOneJob } from "../src/modules/jobs/worker";
import { liveManifest } from "../src/modules/publishing/service";
import { getObject, putObject } from "../src/lib/storage";
import * as storage from "../src/lib/storage";
import sharp from "sharp";
import { textPdf } from "./pdf-fixture";
const educationFixture = () => ({
  id: randomUUID(),
  type: "education" as const,
  title: "Education",
  visible: true,
  intro: "",
  entries: [
    {
      ...emptyEntry(),
      title: "MSc",
      subtitle: "Test university",
      start: "2020",
      end: "2022",
    },
  ],
});
const directory = path.resolve(".test-data", `integration-${randomUUID()}`);
const adminEmail = "admin@integration.test",
  password = "A long integration passphrase 42!";
let adminCookie = "",
  clientCookie = "",
  clientId = "",
  siteId = "",
  secondSiteId = "",
  revision = 1,
  document: PortfolioDocument;
async function request(
  route: string,
  method = "GET",
  value?: unknown,
  cookie = adminCookie,
  origin = "http://localhost:3000",
) {
  const req = new NextRequest(`http://localhost:3000/api/${route}`, {
    method,
    headers: { "content-type": "application/json", origin, cookie },
    ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
  });
  const response = await handle(req, route.split("/"));
  return { response, status: response.status, data: await response.json() };
}
beforeAll(() => {
  process.env.DATA_DIR = directory;
  process.env.SETUP_TOKEN = "integration-setup-secret";
  process.env.SESSION_SECRET =
    "integration-encryption-secret-at-least-32-characters";
  process.env.APP_URL = "http://localhost:3000";
  delete process.env.DATABASE_URL;
  delete process.env.S3_BUCKET;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.CLAMAV_HOST;
  delete process.env.AI_PROVIDER;
  delete process.env.DEPLOYMENT_MODE;
});
afterAll(async () => {
  await closeDb();
  const root = path.resolve(".test-data") + path.sep;
  if (!directory.startsWith(root))
    throw new Error("Test cleanup target escaped its workspace.");
  await rm(directory, { recursive: true, force: true });
});
describe.sequential(
  "Real database, authentication, authorization, and publishing",
  () => {
    it("blocks setup without the installation secret", async () => {
      const result = await request(
        "setup",
        "POST",
        {
          token: "wrong",
          name: "Admin",
          email: adminEmail,
          password,
          agencyName: "Brilliancy Research",
        },
        "",
      );
      expect(result.status).toBe(403);
    });
    it("creates the first administrator exactly once", async () => {
      const input = {
        token: "integration-setup-secret",
        name: "Admin",
        email: adminEmail,
        password,
        agencyName: "Brilliancy Research",
      };
      expect((await request("setup", "POST", input, "")).status).toBe(200);
      expect((await request("setup", "POST", input, "")).status).toBe(409);
    });
    it("rejects a cross-origin write", async () => {
      const result = await request(
        "auth/login",
        "POST",
        { email: adminEmail, password },
        "",
        "https://attacker.test",
      );
      expect(result.status).toBe(403);
    });
    it("authenticates with an opaque HttpOnly session", async () => {
      const result = await request(
        "auth/login",
        "POST",
        { email: adminEmail, password },
        "",
      );
      expect(result.status).toBe(200);
      const setCookie = result.response.headers.get("set-cookie")!;
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=lax");
      adminCookie = setCookie.split(";")[0];
      expect(result.data.user.role).toBe("admin");
    });
    it("rejects unauthenticated API reads", async () => {
      expect((await request("sites", "GET", undefined, "")).status).toBe(401);
    });
    it("creates portfolios and a client invitation without fabricated data", async () => {
      const account = await request("users", "POST", {
        name: "Client",
        email: "client@integration.test",
        role: "client",
      });
      expect(account.status).toBe(201);
      clientId = account.data.id;
      const invitationToken = new URL(account.data.link).searchParams.get(
        "token",
      );
      expect(
        (
          await request(
            "auth/accept",
            "POST",
            { token: invitationToken, password },
            "",
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await request(
            "auth/accept",
            "POST",
            { token: invitationToken, password },
            "",
          )
        ).status,
      ).toBe(400);
      const logged = await request(
        "auth/login",
        "POST",
        { email: "client@integration.test", password },
        "",
      );
      clientCookie = logged.response.headers.get("set-cookie")!.split(";")[0];
      const first = await request("sites", "POST", {
        name: "First Researcher",
        slug: "first-researcher",
        clientId,
      });
      expect(first.status).toBe(201);
      siteId = first.data.id;
      const second = await request("sites", "POST", {
        name: "Second Researcher",
        slug: "second-researcher",
      });
      secondSiteId = second.data.id;
      const result = await request(`sites/${siteId}`);
      document = result.data.site.draft;
      expect(document.sections).toEqual([]);
    });
    it("lists only the client’s own portfolios", async () => {
      const result = await request("sites", "GET", undefined, clientCookie);
      expect(result.data.sites).toHaveLength(1);
      expect(result.data.sites[0].id).toBe(siteId);
      expect(
        (await request(`sites/${secondSiteId}`, "GET", undefined, clientCookie))
          .status,
      ).toBe(404);
    });
    it("blocks clients from managing accounts, permissions, and publishing", async () => {
      expect(
        (await request("users", "GET", undefined, clientCookie)).status,
      ).toBe(403);
      expect(
        (
          await request(
            `sites/${siteId}/permissions`,
            "PUT",
            { clientId, editableFields: ["profile.bio"] },
            clientCookie,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `sites/${siteId}/publish`,
            "POST",
            { revision },
            clientCookie,
          )
        ).status,
      ).toBe(403);
    });
    it("applies per-client permissions on the server", async () => {
      expect(
        (
          await request(`sites/${siteId}/permissions`, "PUT", {
            clientId,
            editableFields: ["profile.bio"],
          })
        ).status,
      ).toBe(200);
      const changed = structuredClone(document);
      changed.profile.bio = "A client-authored biography.";
      const saved = await request(
        `sites/${siteId}`,
        "PUT",
        { document: changed, revision },
        clientCookie,
      );
      expect(saved.status).toBe(200);
      revision = saved.data.revision;
      document = changed;
      const forbidden = structuredClone(changed);
      forbidden.profile.name = "Changed locked name";
      expect(
        (
          await request(
            `sites/${siteId}`,
            "PUT",
            { document: forbidden, revision },
            clientCookie,
          )
        ).status,
      ).toBe(403);
      expect((await request(`sites/${siteId}`)).data.site.status).toBe(
        "review",
      );
    });
    it("rejects a stale editor revision instead of overwriting content", async () => {
      expect(
        (await request(`sites/${siteId}`, "PUT", { document, revision: 1 }))
          .status,
      ).toBe(409);
    });
    it("keeps the dashboard name synchronized with the saved profile", async () => {
      document.profile.name = "Renamed Researcher";
      const saved = await request(`sites/${siteId}`, "PUT", {
        document,
        revision,
      });
      expect(saved.status).toBe(200);
      revision = saved.data.revision;
      expect(
        (await request("sites")).data.sites.find(
          (s: { id: string }) => s.id === siteId,
        ).name,
      ).toBe("Renamed Researcher");
    });
    it("validates, optimizes, and isolates uploaded images", async () => {
      const image = await sharp({
        create: { width: 8, height: 8, channels: 3, background: "#234d3e" },
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.set(
        "file",
        new File([new Uint8Array(image)], "portrait.png", {
          type: "image/png",
        }),
      );
      const response = await handle(
        new NextRequest(`http://localhost:3000/api/sites/${siteId}/media`, {
          method: "POST",
          headers: { origin: "http://localhost:3000", cookie: adminCookie },
          body: form,
        }),
        ["sites", siteId, "media"],
      );
      expect(response.status).toBe(201);
      const uploaded = await response.json();
      const [row] = await (
        await db()
      ).query<{ mime: string; storage_key: string }>(
        "SELECT mime,storage_key FROM media WHERE id=$1",
        [uploaded.id],
      );
      expect(row.mime).toBe("image/webp");
      expect(
        (await getObject(row.storage_key))?.subarray(8, 12).toString(),
      ).toBe("WEBP");
      const anonymous = await handle(
        new NextRequest(`http://localhost:3000/api/media/${uploaded.id}`),
        ["media", uploaded.id],
      );
      expect(anonymous.status).toBe(401);
      const attempt = new FormData();
      attempt.set("file", new File([new Uint8Array(image)], "portrait.png"));
      const denied = await handle(
        new NextRequest(`http://localhost:3000/api/sites/${siteId}/media`, {
          method: "POST",
          headers: { origin: "http://localhost:3000", cookie: clientCookie },
          body: attempt,
        }),
        ["sites", siteId, "media"],
      );
      expect(denied.status).toBe(403);
      const invalid = structuredClone(document);
      invalid.profile.cvId = uploaded.id;
      expect(
        (
          await request(`sites/${siteId}`, "PUT", {
            document: invalid,
            revision,
          })
        ).status,
      ).toBe(400);
      const entry = emptyEntry();
      entry.title = "Preview image";
      entry.mediaId = uploaded.id;
      document.pages.push({
        id: randomUUID(),
        slug: "research",
        title: "Research detail",
        description: "Current projects",
        sections: [
          {
            id: randomUUID(),
            type: "projects",
            title: "Projects",
            intro: "",
            visible: true,
            entries: [entry],
          },
        ],
      });
      const saved = await request(`sites/${siteId}`, "PUT", {
        document,
        revision,
      });
      expect(saved.status).toBe(200);
      revision = saved.data.revision;
      const preview = await handle(
        new NextRequest(
          `http://localhost:3000/api/sites/${siteId}/preview/research`,
          { headers: { cookie: adminCookie } },
        ),
        ["sites", siteId, "preview", "research"],
      );
      expect(preview.status).toBe(200);
      expect(preview.headers.get("x-robots-tag")).toContain("noindex");
      const html = await preview.text();
      expect(html).toContain('class="entry-image"');
      expect(html).toContain(`/api/media/${uploaded.id}`);
      expect(html).toContain(`/api/sites/${siteId}/preview/research`);
      expect(html).not.toContain(`/portfolio/`);
      const missing = await handle(
        new NextRequest(
          `http://localhost:3000/api/sites/${siteId}/preview/missing`,
          { headers: { cookie: adminCookie } },
        ),
        ["sites", siteId, "preview", "missing"],
      );
      expect(missing.status).toBe(404);
    });
    it("rejects an executable disguised as a PDF", async () => {
      const form = new FormData();
      form.set(
        "file",
        new File(["#!/bin/sh\nwhoami"], "article.pdf", {
          type: "application/pdf",
        }),
      );
      const response = await handle(
        new NextRequest(`http://localhost:3000/api/sites/${siteId}/media`, {
          method: "POST",
          headers: { origin: "http://localhost:3000", cookie: adminCookie },
          body: form,
        }),
        ["sites", siteId, "media"],
      );
      expect(response.status).toBe(400);
    });
    it("queues an article summary automatically when AI is configured", async () => {
      process.env.OPENAI_API_KEY = "test-fixture-not-a-real-api-key";
      process.env.OPENAI_MODEL = "test-model";
      try {
        const form = new FormData();
        form.set("purpose", "article");
        form.set(
          "file",
          new File(
            [
              "%PDF-1.4\n% An upload-signature fixture; never sent to an AI service.\n%%EOF",
            ],
            "article.pdf",
            { type: "application/pdf" },
          ),
        );
        const response = await handle(
          new NextRequest(`http://localhost:3000/api/sites/${siteId}/media`, {
            method: "POST",
            headers: { origin: "http://localhost:3000", cookie: adminCookie },
            body: form,
          }),
          ["sites", siteId, "media"],
        );
        expect(response.status).toBe(201);
        expect((await response.json()).summaryQueued).toBe(true);
        const jobs = await (
          await db()
        ).query("SELECT id FROM jobs WHERE site_id=$1 AND kind='abstract'", [
          siteId,
        ]);
        expect(jobs.length).toBe(1);
        await (
          await db()
        ).query("DELETE FROM jobs WHERE site_id=$1 AND kind='abstract'", [
          siteId,
        ]);
      } finally {
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
      }
    });
    it("imports a CV through a leased job, isolates results, and never changes the draft automatically", async () => {
      const database = await db();
      const [media] = await database.query<{ id: string }>(
        "SELECT id FROM media WHERE site_id=$1 AND mime='application/pdf' LIMIT 1",
        [siteId],
      );
      expect(
        (
          await request(
            `media/${media.id}/cv-import`,
            "POST",
            undefined,
            clientCookie,
          )
        ).status,
      ).toBe(403);
      expect(
        (await request(`media/${media.id}/cv-import`, "POST")).status,
      ).toBe(503);
      process.env.OPENAI_API_KEY = "test-only-never-sent";
      process.env.OPENAI_MODEL = "test-model";
      parseCv.mockResolvedValue({
        status: "completed",
        output_parsed: {
          profile: {
            name: "CV Name",
            headline: "Researcher",
            affiliation: "",
            bio: "",
            location: "",
            email: "",
            links: [],
          },
          sections: [],
          warnings: ["Check extracted facts."],
        },
      });
      try {
        const before = (await request(`sites/${siteId}`)).data.site;
        const queued = await request(`media/${media.id}/cv-import`, "POST");
        expect(queued.status).toBe(202);
        expect(
          (await request(`media/${media.id}/cv-import`, "POST")).status,
        ).toBe(409);
        expect(await processOneJob()).toBe(true);
        const result = (await request(`sites/${siteId}`)).data;
        expect(
          result.media.find((m: { id: string }) => m.id === media.id).cv_import
            .profile.name,
        ).toBe("CV Name");
        expect(result.site.draft).toEqual(before.draft);
        expect(result.site.revision).toBe(before.revision);
        expect(
          (await request(`sites/${siteId}`, "GET", undefined, clientCookie))
            .data.media[0],
        ).not.toHaveProperty("cv_import");
        expect(parseCv.mock.calls[0][0].store).toBe(false);
        // A refusal never replaces a previously reviewed extraction.
        parseCv.mockResolvedValue({ status: "completed", output_parsed: null });
        const retry = await request(`media/${media.id}/cv-import`, "POST");
        await database.query("UPDATE jobs SET attempts=2 WHERE id=$1", [
          retry.data.jobId,
        ]);
        await processOneJob();
        expect(
          (
            await database.query<{ status: string }>(
              "SELECT status FROM jobs WHERE id=$1",
              [retry.data.jobId],
            )
          )[0].status,
        ).toBe("failed");
        expect((await request(`sites/${siteId}`)).data.site.draft).toEqual(
          before.draft,
        );
      } finally {
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
      }
    });
    it("processes Gemini CV and automatic summary jobs without changing the portfolio draft", async () => {
      process.env.AI_PROVIDER = "gemini";
      process.env.GEMINI_API_KEY = "integration-test-never-sent";
      process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";
      const generated = [
        {
          abstract: "Test research summary grounded in the fixture.",
          keywords: ["testing"],
          limitations: "Fixture only.",
        },
        {
          profile: {
            name: "Gemini CV Name",
            headline: "",
            affiliation: "",
            bio: "",
            location: "",
            email: "",
            links: [],
          },
          sections: [],
          warnings: [],
        },
      ];
      const provider = vi.spyOn(globalThis, "fetch").mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: "STOP",
                  content: {
                    parts: [{ text: JSON.stringify(generated.shift()) }],
                  },
                },
              ],
            }),
          ),
      );
      try {
        const before = (await request(`sites/${siteId}`)).data.site;
        const form = new FormData();
        form.set("purpose", "article");
        form.set(
          "file",
          new File(
            [
              new Uint8Array(
                textPdf([
                  "Research article fixture for server AI background processing tests.",
                  "This sample has enough text to check extraction without sending a real document to any service.",
                  "Methods and findings in this sample are entirely for automated software verification.",
                ]),
              ),
            ],
            "gemini-test.pdf",
            { type: "application/pdf" },
          ),
        );
        const upload = await handle(
          new NextRequest(`http://localhost:3000/api/sites/${siteId}/media`, {
            method: "POST",
            headers: { origin: "http://localhost:3000", cookie: adminCookie },
            body: form,
          }),
          ["sites", siteId, "media"],
        );
        expect(upload.status).toBe(201);
        const media = await upload.json();
        expect(media.summaryQueued).toBe(true);
        expect(await processOneJob()).toBe(true);
        expect(
          (await request(`media/${media.id}/cv-import`, "POST")).status,
        ).toBe(202);
        expect(await processOneJob()).toBe(true);
        const updated = (await request(`sites/${siteId}`)).data;
        const file = updated.media.find(
          (m: { id: string }) => m.id === media.id,
        );
        expect(file.summary.model).toBe("gemini-3.5-flash-lite");
        expect(file.cv_import.profile.name).toBe("Gemini CV Name");
        expect(updated.site.draft).toEqual(before.draft);
        expect(provider).toHaveBeenCalledTimes(2);
        expect(
          provider.mock.calls.every(([url]) =>
            String(url).startsWith(
              "https://generativelanguage.googleapis.com/",
            ),
          ),
        ).toBe(true);
      } finally {
        provider.mockRestore();
        delete process.env.AI_PROVIDER;
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_MODEL;
      }
    });
    it("stores browser proposals only for administrators, validates them, and does not change the draft", async () => {
      const database = await db();
      const [media] = await database.query<{ id: string }>(
        "SELECT id FROM media WHERE site_id=$1 AND mime='application/pdf' LIMIT 1",
        [siteId],
      );
      const route = `media/${media.id}/browser-ai`;
      const input = {
        task: "abstract",
        result: {
          abstract: "A test proposal.",
          keywords: [],
          limitations: "Test data.",
        },
      };
      expect((await request(route, "PUT", input)).status).toBe(409);
      process.env.AI_PROVIDER = "huggingface-browser";
      process.env.OPENAI_API_KEY = "test-unused-paid-key";
      process.env.OPENAI_MODEL = "test-unused-model";
      try {
        const before = (await request(`sites/${siteId}`)).data.site;
        expect((await request(route, "PUT", input, clientCookie)).status).toBe(
          403,
        );
        expect(
          (await request(route, "POST", { task: "abstract" }, clientCookie))
            .status,
        ).toBe(403);
        expect(
          (await request(route, "PUT", { ...input, result: { abstract: 123 } }))
            .status,
        ).toBe(400);
        expect((await request(route, "PUT", input)).status).toBe(200);
        const cv = {
          profile: {
            name: "Browser Proposal",
            headline: "",
            affiliation: "",
            bio: "",
            location: "",
            email: "",
            links: [],
          },
          sections: [],
          warnings: [],
        };
        expect(
          (await request(route, "PUT", { task: "cv-import", result: cv }))
            .status,
        ).toBe(200);
        const after = (await request(`sites/${siteId}`)).data;
        expect(after.site.draft).toEqual(before.draft);
        expect(after.site.revision).toBe(before.revision);
        expect(
          after.media.find((m: { id: string }) => m.id === media.id).cv_import
            .profile.name,
        ).toBe("Browser Proposal");
        expect(
          (await request(`media/${media.id}/abstract`, "POST")).status,
        ).toBe(503);
        expect(
          (
            await database.query(
              "SELECT * FROM audit_events WHERE action='ai.browser_proposal_saved' AND site_id=$1",
              [siteId],
            )
          ).length,
        ).toBe(2);
      } finally {
        delete process.env.AI_PROVIDER;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
      }
    });
    it("persists demo files in PostgreSQL and scopes transactional cleanup", async () => {
      process.env.DEPLOYMENT_MODE = "demo";
      const own = `private/${randomUUID()}/`,
        other = `private/${randomUUID()}/`;
      try {
        await putObject(`${own}test.pdf`, "original", "application/pdf");
        await putObject(`${other}test.pdf`, "keep", "application/pdf");
        await (
          await db()
        ).transaction(async (tx) => {
          await putObject(`${own}test.pdf`, "updated", "application/pdf", tx);
        });
        expect((await getObject(`${own}test.pdf`))?.toString()).toBe("updated");
        await (
          await db()
        ).transaction((tx) => storage.deletePortfolioFiles(own, tx));
        expect(await getObject(`${own}test.pdf`)).toBeNull();
        expect((await getObject(`${other}test.pdf`))?.toString()).toBe("keep");
        await expect(
          storage.deletePortfolioFiles("private/"),
        ).rejects.toThrow();
        await storage.deletePortfolioFiles(other);
      } finally {
        delete process.env.DEPLOYMENT_MODE;
      }
    });
    it("publishes, unpublishes and restores a release using transactional demo storage", async () => {
      process.env.DEPLOYMENT_MODE = "demo";
      try {
        const slug = `demo-${randomUUID()}`;
        const created = await request("sites", "POST", {
          name: "Demo integration fixture",
          slug,
        });
        expect(created.status).toBe(201);
        const id = created.data.id;
        expect(
          (await request(`sites/${id}/publish`, "POST", { revision: 1 }))
            .status,
        ).toBe(400);
        const draft = emptyDocument("Demo integration fixture");
        draft.sections = [educationFixture()];
        const saved = await request(`sites/${id}`, "PUT", {
          document: draft,
          revision: 1,
        });
        expect(saved.status).toBe(200);
        expect(
          (
            await request(`sites/${id}/publish`, "POST", {
              revision: saved.data.revision,
            })
          ).status,
        ).toBe(202);
        await processOneJob();
        const live = await liveManifest(slug);
        expect(live).not.toBeNull();
        expect(
          (await getObject(live!.routes["index.html"].key))?.toString(),
        ).toContain("Demo integration fixture");
        expect((await request(`sites/${id}/unpublish`, "POST")).status).toBe(
          200,
        );
        expect(await liveManifest(slug)).toBeNull();
        expect(
          (
            await request(`sites/${id}/rollback`, "POST", {
              releaseId: live!.releaseId,
            })
          ).status,
        ).toBe(200);
        expect((await liveManifest(slug))?.releaseId).toBe(live!.releaseId);
      } finally {
        delete process.env.DEPLOYMENT_MODE;
      }
    });
    it("rejects references to another tenant’s media", async () => {
      const foreign = structuredClone(document);
      foreign.profile.cvId = randomUUID();
      expect(
        (
          await request(`sites/${siteId}`, "PUT", {
            document: foreign,
            revision,
          })
        ).status,
      ).toBe(400);
    });
    it("saves academic sections and queues an immutable publishing snapshot", async () => {
      document.theme.font = "fraunces";
      document.theme.bodyFont = "dm-sans";
      document.sections = [
        educationFixture(),
        {
          id: randomUUID(),
          type: "about",
          title: "About",
          visible: true,
          intro: "",
          entries: [],
        },
        {
          id: randomUUID(),
          type: "publications",
          title: "Publications",
          visible: true,
          intro: "",
          entries: [
            {
              ...emptyEntry(),
              title: "A paper",
              body: "An author-written abstract.",
              start: "2025-06",
              authors: "A. Author",
              abstractSource: "original",
            },
          ],
        },
      ];
      const saved = await request(`sites/${siteId}`, "PUT", {
        document,
        revision,
      });
      expect(saved.status).toBe(200);
      revision = saved.data.revision;
      const publish = await request(`sites/${siteId}/publish`, "POST", {
        revision,
      });
      expect(publish.status).toBe(202);
      expect(
        (await request(`sites/${siteId}/publish`, "POST", { revision })).status,
      ).toBe(409);
      const newer = structuredClone(document);
      newer.profile.bio =
        "A newer draft that must not appear in the queued release.";
      const changed = await request(`sites/${siteId}`, "PUT", {
        document: newer,
        revision,
      });
      revision = changed.data.revision;
      document = newer;
      expect(await processOneJob()).toBe(true);
      const fontsManifest = await liveManifest("first-researcher");
      expect(fontsManifest?.routes["fonts/fraunces.woff2"].type).toBe(
        "font/woff2",
      );
      expect(
        (await getObject(fontsManifest!.routes["fonts/dm-sans.woff2"].key))
          ?.subarray(0, 4)
          .toString(),
      ).toBe("wOF2");
      const manifest = await liveManifest("first-researcher");
      expect(manifest).not.toBeNull();
      expect(manifest!.routes["favicon.svg"].type).toBe("image/svg+xml");
      expect(
        (await getObject(manifest!.routes["favicon.svg"].key))?.toString(),
      ).toContain("<svg");
      expect(manifest!.baseUrl).toBe(
        "http://localhost:3000/portfolio/first-researcher",
      );
      const html = (await getObject(
        manifest!.routes["index.html"].key,
      ))!.toString();
      expect(html).toContain("A client-authored biography.");
      expect(html).not.toContain("A newer draft");
      expect(html).toContain(
        'rel="canonical" href="http://localhost:3000/portfolio/first-researcher"',
      );
      expect(html).not.toContain("http://localhost:3000/p/first-researcher");
      const result = await request(`sites/${siteId}`);
      expect(result.data.site.status).toBe("draft");
      expect(result.data.publishedDocument.profile.bio).toBe(
        "A client-authored biography.",
      );
      expect(result.data.jobs[0].status).toBe("done");
    });
    it("keeps published pages available when a new job fails", async () => {
      const before = await liveManifest("first-researcher");
      await (
        await db()
      ).query(
        "INSERT INTO jobs(id,site_id,kind,payload,attempts) VALUES($1,$2,'publish',$3,2)",
        [
          randomUUID(),
          siteId,
          JSON.stringify({
            document: { invalid: true },
            revision,
            slug: "first-researcher",
          }),
        ],
      );
      await processOneJob();
      expect((await liveManifest("first-researcher"))?.releaseId).toBe(
        before?.releaseId,
      );
    });
    it("restores a historical draft as a new revision", async () => {
      const result = await request(`sites/${siteId}/restore`, "POST", {
        revision: 1,
        currentRevision: revision,
      });
      expect(result.status).toBe(200);
      revision = result.data.revision;
      const restored = await request(`sites/${siteId}`);
      expect(restored.data.site.draft.profile.bio).toBe("");
      expect(restored.data.site.revision).toBe(revision);
    });
    it("stores contact messages only for published sites", async () => {
      const form = new URLSearchParams({
        siteId,
        name: "Visitor",
        email: "visitor@integration.test",
        message: "I would like to discuss your research.",
        website: "",
      });
      const req = new NextRequest("http://localhost:3000/api/public/inquiry", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const response = await handle(req, ["public", "inquiry"]);
      expect(response.status).toBe(200);
      expect(
        (await request("inquiries", "GET", undefined, clientCookie)).data
          .inquiries,
      ).toHaveLength(1);
    });
    it("unpublishes without deleting the saved content", async () => {
      expect(
        (
          await request(`sites/${siteId}`, "DELETE", {
            slug: "first-researcher",
            revision,
          })
        ).status,
      ).toBe(409);
      expect(
        (await request(`sites/${siteId}/unpublish`, "POST", {})).status,
      ).toBe(200);
      expect(await liveManifest("first-researcher")).toBeNull();
      expect((await request(`sites/${siteId}`)).status).toBe(200);
      expect(
        (
          await request(`sites/${siteId}`, "DELETE", {
            slug: "first-researcher",
            revision,
          })
        ).status,
      ).toBe(409);
    });
    it("deletes only a confirmed unused draft, retains audit history and cleans private and failed-release files", async () => {
      const created = await request("sites", "POST", {
        name: "Disposable draft",
        slug: "disposable-draft",
        clientId,
      });
      const id = created.data.id;
      const confirm = { slug: "disposable-draft", revision: 1 };
      expect(
        (await request(`sites/${id}`, "DELETE", confirm, clientCookie)).status,
      ).toBe(403);
      expect(
        (await request(`sites/${id}`, "DELETE", { ...confirm, slug: "wrong" }))
          .status,
      ).toBe(409);
      expect(
        (await request(`sites/${id}`, "DELETE", { ...confirm, revision: 2 }))
          .status,
      ).toBe(409);
      const database = await db();
      const jobId = randomUUID();
      await database.query(
        "INSERT INTO jobs(id,site_id,kind,payload) VALUES($1,$2,'publish','{}')",
        [jobId, id],
      );
      expect((await request(`sites/${id}`, "DELETE", confirm)).status).toBe(
        409,
      );
      await database.query("UPDATE jobs SET status='failed' WHERE id=$1", [
        jobId,
      ]);
      const privateKey = `private/${id}/original.pdf`,
        releaseKey = `releases/${id}/${jobId}/index.html`;
      await putObject(privateKey, "fixture", "application/pdf");
      await putObject(releaseKey, "fixture", "text/html");
      expect((await request(`sites/${id}`, "DELETE", confirm)).status).toBe(
        200,
      );
      expect((await request(`sites/${id}`)).status).toBe(404);
      expect(
        await database.query("SELECT * FROM revisions WHERE site_id=$1", [id]),
      ).toHaveLength(0);
      expect(
        await database.query("SELECT * FROM jobs WHERE site_id=$1", [id]),
      ).toHaveLength(0);
      expect(
        await database.query(
          "SELECT * FROM audit_events WHERE site_id=$1 AND action='portfolio.deleted'",
          [id],
        ),
      ).toHaveLength(1);
      expect(
        await database.query("SELECT * FROM users WHERE id=$1", [clientId]),
      ).toHaveLength(1);
      const cleanupFailure = vi
        .spyOn(storage, "deletePortfolioFiles")
        .mockRejectedValueOnce(new Error("Simulated storage outage"));
      try {
        expect(await processOneJob()).toBe(true);
      } finally {
        cleanupFailure.mockRestore();
      }
      expect(
        await database.query("SELECT * FROM storage_cleanup WHERE attempts=1"),
      ).toHaveLength(1);
      await database.query("UPDATE storage_cleanup SET available_at=now()");
      expect(await processOneJob()).toBe(true);
      expect(await processOneJob()).toBe(true);
      expect(await getObject(privateKey)).toBeNull();
      expect(await getObject(releaseKey)).toBeNull();
      expect(
        await database.query("SELECT * FROM storage_cleanup"),
      ).toHaveLength(0);
    });
    it("disabling a client revokes existing sessions", async () => {
      expect(
        (await request(`users/${clientId}`, "PATCH", { disabled: true }))
          .status,
      ).toBe(200);
      expect(
        (await request("sites", "GET", undefined, clientCookie)).status,
      ).toBe(401);
      expect(
        (
          await (
            await db()
          ).query("SELECT * FROM sessions WHERE token_hash=$1", [
            hash(clientCookie.split("=")[1]),
          ])
        ).length,
      ).toBe(0);
    });
  },
);
