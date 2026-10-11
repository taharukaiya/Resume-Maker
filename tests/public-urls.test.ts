import { describe, expect, it } from "vitest";
import { migratePublicUrls } from "../src/modules/publishing/public-urls";

describe("published portfolio URL migration", () => {
  const base = "https://app.example.org";
  it("updates old canonical, navigation, asset and sitemap URLs without republishing", () => {
    const old = `${base}/p/researcher`;
    const text = `<link rel="canonical" href="${old}"><a href="${old}/research?q=1#results">Research</a><img src="${old}/assets/photo.webp"><loc>${old}</loc>\nSitemap: ${old}/sitemap.xml`;
    expect(migratePublicUrls(text, "researcher", [base])).toBe(
      text.replaceAll(old, `${base}/portfolio/researcher`),
    );
  });
  it("preserves custom domain URLs, external URLs, and other portfolio slugs", () => {
    const text = `<a href="https://researcher.org/research">Research</a><a href="https://elsewhere.org/p/researcher">External</a><a href="${base}/p/researcher-two">Other</a>`;
    expect(migratePublicUrls(text, "researcher", [base])).toBe(text);
  });
  it("is idempotent and handles old release origins and trailing slashes", () => {
    const oldBase = "http://localhost:3000";
    const text = `<a href="${oldBase}/p/researcher">Home</a>`;
    const migrated = migratePublicUrls(text, "researcher", [
      `${base}/`,
      oldBase,
    ]);
    expect(migrated).toContain(`${oldBase}/portfolio/researcher`);
    expect(migratePublicUrls(migrated, "researcher", [base, oldBase])).toBe(
      migrated,
    );
  });
});
