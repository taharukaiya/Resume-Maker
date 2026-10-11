import { expect, test } from "@playwright/test";

test("legacy portfolio URLs permanently redirect with nested paths and queries intact", async ({
  request,
}) => {
  for (const suffix of [
    "",
    "/research?source=shared",
    "/assets/photo.webp",
    "/publications/paper",
    "/sitemap.xml",
  ]) {
    const response = await request.get(`/p/url-migration-test${suffix}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    const location = new URL(
      response.headers().location,
      "http://localhost:3100",
    );
    expect(location.pathname + location.search).toBe(
      `/portfolio/url-migration-test${suffix}`,
    );
  }
  const unpublished = await request.get("/portfolio/url-migration-test");
  expect(unpublished.status()).toBe(404);
  expect(await unpublished.text()).toBe("This portfolio is not published.");
});
