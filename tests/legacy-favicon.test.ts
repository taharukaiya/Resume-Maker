import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { emptyDocument } from "../src/modules/portfolios/schema";
import type { ReleaseManifest } from "../src/modules/publishing/service";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getObject: vi.fn(),
  liveManifest: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({ db: async () => ({ query: mocks.query }) }));
vi.mock("../src/lib/storage", () => ({ getObject: mocks.getObject }));
vi.mock("../src/modules/publishing/service", () => ({
  liveManifest: mocks.liveManifest,
}));
import { GET } from "../src/app/portfolio/[slug]/[[...path]]/route";

const document = emptyDocument("Published Researcher");
document.profile.portraitId = crypto.randomUUID();
const manifest: ReleaseManifest = {
  siteId: crypto.randomUUID(),
  releaseId: crypto.randomUUID(),
  revision: 1,
  slug: "researcher",
  baseUrl: "http://localhost:3000/portfolio/researcher",
  routes: {
    "index.html": {
      key: "releases/test/index.html",
      type: "text/html; charset=utf-8",
    },
    "contact/index.html": {
      key: "releases/test/contact/index.html",
      type: "text/html; charset=utf-8",
    },
    [`assets/${document.profile.portraitId}.webp`]: {
      key: "releases/test/published-portrait.webp",
      type: "image/webp",
    },
  },
};
const html =
  "<!doctype html><html><head><title>Published Researcher</title></head><body>Published content</body></html>";
const request = (path: string[] = []) =>
  GET(
    new NextRequest(
      `http://localhost:3000/portfolio/researcher/${path.join("/")}`,
    ),
    { params: Promise.resolve({ slug: "researcher", path }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.liveManifest.mockResolvedValue(structuredClone(manifest));
  mocks.query.mockResolvedValue([{ document: structuredClone(document) }]);
  mocks.getObject.mockResolvedValue(Buffer.from(html));
});

describe("Legacy published portfolio favicons", () => {
  it("adds the published photo icon to old home and nested pages without changing their content", async () => {
    for (const path of [[], ["contact"]]) {
      const response = await request(path);
      const page = await response.text();
      expect(response.status).toBe(200);
      expect(page).toContain(
        `rel="icon" type="image/png" href="/portfolio/researcher/favicon.png?v=legacy-1-${manifest.releaseId}"`,
      );
      expect(page.replace(/<link rel="icon"[^>]+>/, "")).toBe(html);
    }
    expect(mocks.query).toHaveBeenCalledWith(
      "SELECT document FROM releases WHERE id=$1 AND site_id=$2",
      [manifest.releaseId, manifest.siteId],
    );
  });
  it("serves a small valid PNG from the release copy, never a private or draft image", async () => {
    mocks.getObject.mockResolvedValue(
      await sharp({
        create: { width: 160, height: 200, channels: 3, background: "#164e63" },
      })
        .webp()
        .toBuffer(),
    );
    const response = await request(["favicon.png"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const metadata = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    expect([metadata.width, metadata.height]).toEqual([64, 64]);
    expect(mocks.getObject).toHaveBeenCalledExactlyOnceWith(
      "releases/test/published-portrait.webp",
    );
  });
  it("uses initials when the portrait is absent from the published assets", async () => {
    const withoutPhoto = structuredClone(manifest);
    delete withoutPhoto.routes[`assets/${document.profile.portraitId}.webp`];
    mocks.liveManifest.mockResolvedValue(withoutPhoto);
    expect(await (await request()).text()).toContain(
      'rel="icon" type="image/svg+xml"',
    );
    const response = await request(["favicon.svg"]);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(await response.text()).toContain(">PR</text>");
  });
  it("leaves modern releases unchanged without querying the database", async () => {
    const modern = html.replace(
      "</head>",
      '<link rel="icon" href="/published-icon.png"></head>',
    );
    mocks.getObject.mockResolvedValue(Buffer.from(modern));
    expect(await (await request()).text()).toBe(modern);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("keeps unknown pages and unpublished portfolios private", async () => {
    expect((await request(["unknown"])).status).toBe(404);
    expect((await request(["__proto__"])).status).toBe(404);
    expect((await request(["constructor"])).status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.liveManifest.mockResolvedValue(null);
    expect((await request(["favicon.png"])).status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
