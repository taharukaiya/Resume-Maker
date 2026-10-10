import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rm } from "node:fs/promises";
import { handle } from "../src/modules/api/router";
import { db, closeDb } from "../src/lib/db";
import { hash } from "../src/lib/crypto";
import {
  emptyEntry,
  type PortfolioDocument,
} from "../src/modules/portfolios/schema";
import { processOneJob } from "../src/modules/jobs/worker";
import { liveManifest } from "../src/modules/publishing/service";
import { getObject } from "../src/lib/storage";
import sharp from "sharp";
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
      expect(html).not.toContain(`/p/`);
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
      document.sections = [
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
      const manifest = await liveManifest("first-researcher");
      expect(manifest).not.toBeNull();
      const html = (await getObject(
        manifest!.routes["index.html"].key,
      ))!.toString();
      expect(html).toContain("A client-authored biography.");
      expect(html).not.toContain("A newer draft");
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
        (await request(`sites/${siteId}/unpublish`, "POST", {})).status,
      ).toBe(200);
      expect(await liveManifest("first-researcher")).toBeNull();
      expect((await request(`sites/${siteId}`)).status).toBe(200);
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
