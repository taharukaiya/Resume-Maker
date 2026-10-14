import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const { resolveTxt } = vi.hoisted(() => ({ resolveTxt: vi.fn() }));
vi.mock("node:dns/promises", () => ({ resolveTxt }));
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { db, closeDb } from "../src/lib/db";
import { hash } from "../src/lib/crypto";
import { handle } from "../src/modules/api/router";
import { emptyDocument, emptyEntry } from "../src/modules/portfolios/schema";
import { processOneJob } from "../src/modules/jobs/worker";

const directory = path.resolve(".test-data", `domains-${randomUUID()}`);
const appUrl = "http://studio.example.test";
const adminId = randomUUID(),
  clientId = randomUUID();
const adminToken = randomUUID(),
  clientToken = randomUUID();
const adminCookie = `brilliancy_session=${adminToken}`;
const clientCookie = `brilliancy_session=${clientToken}`;

async function request(
  route: string,
  method = "GET",
  value?: unknown,
  cookie = adminCookie,
) {
  const response = await handle(
    new NextRequest(`${appUrl}/api/${route}`, {
      method,
      headers: { origin: appUrl, cookie, "content-type": "application/json" },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    }),
    route.split("/"),
  );
  return { status: response.status, data: await response.json() };
}

async function createSite() {
  const slug = `site-${randomUUID()}`;
  const created = await request("sites", "POST", {
    name: "Researcher",
    slug,
    clientId,
  });
  expect(created.status).toBe(201);
  const id = created.data.id as string;
  const document = emptyDocument("Researcher");
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
          title: "PhD",
          subtitle: "University",
          start: "2020",
          end: "2024",
        },
      ],
    },
  ];
  await (
    await db()
  ).query("UPDATE sites SET draft=$1 WHERE id=$2", [
    JSON.stringify(document),
    id,
  ]);
  return { id, slug };
}

async function addDomain(
  siteId: string,
  hostname = `research-${randomUUID()}.example.test`,
) {
  const result = await request(`sites/${siteId}/domains`, "POST", { hostname });
  expect(result.status).toBe(201);
  return { id: result.data.id as string, hostname };
}

async function activate(domainId: string) {
  await (
    await db()
  ).query(
    "UPDATE domains SET verified_at=now(),activated_at=now() WHERE id=$1",
    [domainId],
  );
}

beforeAll(async () => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "test",
    DATA_DIR: directory,
    APP_URL: appUrl,
    PUBLIC_ASSET_URL: "https://media.example.test",
    DATABASE_URL: "",
    DATABASE_SECRET_ARN: "",
    S3_BUCKET: "",
    PUBLIC_BUCKET: "",
    DEPLOYMENT_MODE: "vps",
    SESSION_SECRET: "domain-tests-private-secret-at-least-32-characters",
  }))
    vi.stubEnv(key, value);
  const database = await db();
  await database.query(
    "INSERT INTO users(id,email,name,role) VALUES($1,'domain-admin@example.test','Admin','admin'),($2,'domain-client@example.test','Client','client')",
    [adminId, clientId],
  );
  await database.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour'),($3,$4,now()+interval '1 hour')",
    [hash(adminToken), adminId, hash(clientToken), clientId],
  );
});

afterAll(async () => {
  await closeDb();
  vi.unstubAllEnvs();
  if (!directory.startsWith(path.resolve(".test-data") + path.sep))
    throw new Error("Unsafe test cleanup path.");
  await rm(directory, { recursive: true, force: true });
});

describe.sequential("Administrator website address management", () => {
  it("requires an authenticated administrator and preserves site isolation", async () => {
    const site = await createSite();
    const foreign = await createSite();
    await (
      await db()
    ).query("UPDATE sites SET client_id=NULL WHERE id=$1", [foreign.id]);
    for (const method of ["GET", "POST", "PUT", "DELETE"]) {
      const input =
        method === "GET"
          ? undefined
          : method === "POST"
            ? { hostname: "unauthorized.example.test" }
            : { domainId: randomUUID() };
      expect(
        (await request(`sites/${site.id}/domains`, method, input, "")).status,
      ).toBe(401);
      expect(
        (await request(`sites/${site.id}/domains`, method, input, clientCookie))
          .status,
      ).toBe(403);
      expect(
        (
          await request(
            `sites/${foreign.id}/domains`,
            method,
            input,
            clientCookie,
          )
        ).status,
      ).toBe(404);
    }
    vi.stubEnv("NODE_ENV", "production");
    try {
      const result = await request(
        `sites/${site.id}/domains`,
        "GET",
        undefined,
        `__Host-brilliancy_session=${adminToken}`,
      );
      expect(result.status).toBe(403);
      expect(result.data.error).toContain("two-factor");
    } finally {
      vi.stubEnv("NODE_ENV", "test");
    }
  });

  it("normalizes root URLs and rejects duplicate hostnames across portfolios", async () => {
    const first = await createSite(),
      second = await createSite();
    await addDomain(first.id, "  HTTPS://ResearchByTest.Example.Test/  ");
    const result = await request(`sites/${first.id}/domains`);
    expect(result.data.hostingMode).toBe("vps");
    expect(result.data.domains[0]).toMatchObject({
      hostname: "researchbytest.example.test",
      is_primary: false,
      verified_at: null,
      activated_at: null,
    });
    const duplicate = await request(`sites/${second.id}/domains`, "POST", {
      hostname: "researchbytest.example.test",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.data.error).toContain("already been added");
  });

  it("rejects paths, credentials, explicit ports, addresses and reserved hosts", async () => {
    const site = await createSite();
    for (const hostname of [
      "https://example.test/portfolio/name",
      "https://example.test/.",
      "https://example.test/?",
      "https://example.test/#",
      "https://user:password@example.test",
      "https://example.test:443",
      "example.test:8080",
      "https://127.0.0.1",
      "127.1",
      "https://[::1]",
      "*.example.test",
      "http://example.test",
      "https://studio.example.test/",
      "media.example.test.",
      "https://example.test\\path",
      "https://example%2etest",
    ])
      expect(
        (await request(`sites/${site.id}/domains`, "POST", { hostname }))
          .status,
        hostname,
      ).toBe(400);
  });

  it("verifies exact DNS proof but does not activate hosting or select the address", async () => {
    const site = await createSite(),
      domain = await addDomain(site.id);
    const [{ verification_token: proof }] = await (
      await db()
    ).query<{ verification_token: string }>(
      "SELECT verification_token FROM domains WHERE id=$1",
      [domain.id],
    );
    resolveTxt.mockResolvedValueOnce([["wrong-proof"]]);
    expect(
      (
        await request(`sites/${site.id}/verify-domain`, "POST", {
          domainId: domain.id,
        })
      ).status,
    ).toBe(400);
    resolveTxt.mockResolvedValueOnce([[proof.slice(0, 8), proof.slice(8)]]);
    expect(
      (
        await request(`sites/${site.id}/verify-domain`, "POST", {
          domainId: domain.id,
        })
      ).status,
    ).toBe(200);
    expect(resolveTxt).toHaveBeenLastCalledWith(
      `_brilliancy.${domain.hostname}`,
    );
    const result = await request(`sites/${site.id}/domains`);
    expect(result.data.domains[0].verified_at).toBeTruthy();
    expect(result.data.domains[0]).toMatchObject({
      activated_at: null,
      is_primary: false,
    });
    expect(
      (
        await request(`sites/${site.id}/domains`, "PUT", {
          domainId: domain.id,
        })
      ).status,
    ).toBe(409);
  });

  it("requires a ready domain belonging to the same portfolio for selection", async () => {
    const first = await createSite(),
      second = await createSite();
    const domain = await addDomain(first.id);
    for (const method of ["PUT", "DELETE"])
      expect(
        (
          await request(`sites/${second.id}/domains`, method, {
            domainId: domain.id,
          })
        ).status,
      ).toBe(404);
    expect(
      (
        await request(`sites/${second.id}/verify-domain`, "POST", {
          domainId: domain.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(`sites/${first.id}/domains`, "PUT", {
          domainId: domain.id,
        })
      ).status,
    ).toBe(409);
    await activate(domain.id);
    vi.stubEnv("DEPLOYMENT_MODE", "");
    try {
      expect(
        (
          await request(`sites/${first.id}/domains`, "PUT", {
            domainId: domain.id,
          })
        ).status,
      ).toBe(409);
    } finally {
      vi.stubEnv("DEPLOYMENT_MODE", "vps");
    }
    expect(
      (
        await request(`sites/${first.id}/domains`, "PUT", {
          domainId: domain.id,
        })
      ).status,
    ).toBe(200);
  });

  it("publishes only the selected domain and keeps live links unchanged until republishing", async () => {
    const site = await createSite();
    const first = await addDomain(site.id),
      second = await addDomain(site.id);
    await activate(first.id);
    await activate(second.id);
    expect(
      (await request(`sites/${site.id}/publish`, "POST", { revision: 1 }))
        .status,
    ).toBe(202);
    await processOneJob();
    const shared = `${appUrl}/portfolio/${site.slug}`;
    expect((await request(`sites/${site.id}`)).data.publishedUrl).toBe(shared);
    expect(
      (
        await request(`sites/${site.id}/domains`, "PUT", {
          domainId: second.id,
        })
      ).status,
    ).toBe(200);
    let domains = (await request(`sites/${site.id}/domains`)).data.domains;
    expect(
      domains
        .filter((item: { is_primary: boolean }) => item.is_primary)
        .map((item: { id: string }) => item.id),
    ).toEqual([second.id]);
    expect((await request(`sites/${site.id}`)).data.publishedUrl).toBe(shared);
    expect(
      (await request("sites")).data.sites.find(
        (item: { id: string }) => item.id === site.id,
      ).publishedUrl,
    ).toBe(shared);
    expect(
      (await request(`sites/${site.id}/publish`, "POST", { revision: 1 }))
        .status,
    ).toBe(202);
    expect(
      (await request(`sites/${site.id}/domains`, "PUT", { domainId: first.id }))
        .status,
    ).toBe(409);
    expect(
      (await request(`sites/${site.id}/domains`, "PUT", { domainId: null }))
        .status,
    ).toBe(409);
    const [queued] = await (
      await db()
    ).query<{ payload: { canonicalUrl: string } }>(
      "SELECT payload FROM jobs WHERE site_id=$1 AND status='queued'",
      [site.id],
    );
    expect(queued.payload.canonicalUrl).toBe(`https://${second.hostname}`);
    await processOneJob();
    expect((await request(`sites/${site.id}`)).data.publishedUrl).toBe(
      `https://${second.hostname}`,
    );
    expect(
      (await request("sites")).data.sites.find(
        (item: { id: string }) => item.id === site.id,
      ).publishedUrl,
    ).toBe(`https://${second.hostname}`);
    expect(
      (await request(`sites/${site.id}/domains`, "PUT", { domainId: first.id }))
        .status,
    ).toBe(200);
    domains = (await request(`sites/${site.id}/domains`)).data.domains;
    expect(
      domains
        .filter((item: { is_primary: boolean }) => item.is_primary)
        .map((item: { id: string }) => item.id),
    ).toEqual([first.id]);
    expect(
      (await request(`sites/${site.id}/domains`, "PUT", { domainId: null }))
        .status,
    ).toBe(200);
    expect(
      (await request(`sites/${site.id}/publish`, "POST", { revision: 1 }))
        .status,
    ).toBe(202);
    await processOneJob();
    expect((await request(`sites/${site.id}`)).data.publishedUrl).toBe(shared);
  });

  it("removes only unused setup entries and records scoped audit events", async () => {
    const site = await createSite();
    const pending = await addDomain(site.id),
      connected = await addDomain(site.id);
    await activate(connected.id);
    expect(
      (
        await request(`sites/${site.id}/domains`, "DELETE", {
          domainId: connected.id,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`sites/${site.id}/domains`, "DELETE", {
          domainId: pending.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`sites/${site.id}/domains`, "DELETE", {
          domainId: pending.id,
        })
      ).status,
    ).toBe(404);
    const events = await (
      await db()
    ).query<{ action: string; details: { domainId: string } }>(
      "SELECT action,details FROM audit_events WHERE site_id=$1 ORDER BY created_at",
      [site.id],
    );
    expect(
      events.some(
        (event) =>
          event.action === "domain.removed" &&
          event.details.domainId === pending.id,
      ),
    ).toBe(true);
    await (
      await db()
    ).query("UPDATE domains SET activated_at=NULL WHERE id=$1", [connected.id]);
    await (
      await db()
    ).query(
      "INSERT INTO audit_events(id,actor_id,site_id,action,details) VALUES($1,$2,$3,'portfolio.publish_requested',$4)",
      [
        randomUUID(),
        adminId,
        site.id,
        JSON.stringify({ domainId: connected.id }),
      ],
    );
    expect(
      (
        await request(`sites/${site.id}/domains`, "DELETE", {
          domainId: connected.id,
        })
      ).status,
    ).toBe(409);
  });

  it("reports legacy shared links consistently in the list and editor", async () => {
    const site = await createSite();
    expect(
      (await request(`sites/${site.id}/publish`, "POST", { revision: 1 }))
        .status,
    ).toBe(202);
    await processOneJob();
    await (
      await db()
    ).query(
      "UPDATE releases SET manifest=jsonb_set(manifest,'{baseUrl}',$1::jsonb) WHERE site_id=$2",
      [JSON.stringify(`${appUrl}/p/${site.slug}`), site.id],
    );
    const expected = `${appUrl}/portfolio/${site.slug}`;
    expect((await request(`sites/${site.id}`)).data.publishedUrl).toBe(
      expected,
    );
    expect(
      (await request("sites")).data.sites.find(
        (item: { id: string }) => item.id === site.id,
      ).publishedUrl,
    ).toBe(expected);
  });

  it("preserves the published domain on migration, falls back to oldest and enforces one primary", async () => {
    const isolated = new PGlite();
    try {
      await isolated.exec(
        "CREATE TABLE domains(id text PRIMARY KEY,site_id text,hostname text,verified_at timestamptz,activated_at timestamptz,created_at timestamptz)",
      );
      await isolated.exec(
        "CREATE TABLE sites(id text PRIMARY KEY,published_release_id text)",
      );
      await isolated.exec(
        "CREATE TABLE releases(id text PRIMARY KEY,site_id text,manifest jsonb)",
      );
      await isolated.exec(
        "INSERT INTO sites VALUES ('site',NULL),('published','release')",
      );
      await isolated.exec(
        "INSERT INTO releases VALUES ('release','published','{\"baseUrl\":\"https://published.example.test/\"}')",
      );
      await isolated.exec(
        "INSERT INTO domains VALUES ('pending','site','pending.example.test',NULL,NULL,'2020-01-01'),('old','site','old.example.test',now(),now(),'2021-01-01'),('new','site','new.example.test',now(),now(),'2022-01-01'),('older-alias','published','alias.example.test',now(),now(),'2020-01-01'),('current','published','published.example.test',now(),now(),'2021-01-01')",
      );
      await isolated.exec(
        await readFile(
          path.resolve("migrations/007_primary_domain.sql"),
          "utf8",
        ),
      );
      expect(
        (
          await isolated.query(
            "SELECT id FROM domains WHERE is_primary ORDER BY id",
          )
        ).rows,
      ).toEqual([{ id: "current" }, { id: "old" }]);
      await expect(
        isolated.exec("UPDATE domains SET is_primary=true WHERE id='new'"),
      ).rejects.toThrow();
    } finally {
      await isolated.close();
    }
  });
});
