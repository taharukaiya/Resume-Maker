import { test, expect } from "@playwright/test";
import { signInAdmin } from "./admin-session";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";

test("250 articles save, publish, filter and edit with bounded mobile and desktop lists", async ({
  page,
}) => {
  test.setTimeout(240000);
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" };
  const slug = `scale-${Date.now()}`;
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Scale Researcher", slug },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const doc = emptyDocument("Scale Researcher");
  doc.profile.headline = "Physician and researcher";
  doc.profile.affiliation = "University should not become the homepage badge";
  doc.navigation.archivePageSize = 12;
  doc.navigation.trendingTopics = ["Relapse", "MYC"];
  doc.sections = [
    {
      id: crypto.randomUUID(),
      type: "education",
      title: "Education",
      visible: true,
      intro: "",
      entries: [
        {
          ...emptyEntry(),
          title: "Degree",
          subtitle: "University",
          start: "2020",
          end: "2024",
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      type: "articles",
      title: "Articles",
      visible: true,
      intro: "",
      entries: Array.from({ length: 250 }, (_, index) => ({
        ...emptyEntry(),
        title: `Article ${String(index).padStart(3, "0")}`,
        authors: "Research Author",
        body: "Evidence and limitations. ".repeat(400),
        fullText: "Full article content.",
        start: "2025",
        category: "Clinical research",
        tags: index % 2 ? "MYC" : "Relapse",
      })),
    },
  ];
  expect(JSON.stringify(doc).length).toBeGreaterThan(2 * 1024 * 1024);
  const saved = await page.request.put(`/api/sites/${id}`, {
    headers,
    data: { document: doc, revision: 1 },
  });
  expect(saved.status()).toBe(200);
  const savedData = await (await page.request.get(`/api/sites/${id}`)).json();
  const published = await page.request.post(`/api/sites/${id}/publish`, {
    headers,
    data: { revision: savedData.site.revision },
  });
  expect(published.status()).toBe(202);
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/sites/${id}`)).json()).site.status,
      { timeout: 120000 },
    )
    .toBe("published");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/portfolio/${slug}/article`);
    await expect(
      page.locator("[data-article-list] [data-article]"),
    ).toHaveCount(12);
    await page.getByRole("button", { name: "#MYC", exact: true }).click();
    await expect(page.locator("[data-result-count]")).toHaveText(
      "125 articles",
    );
    await page.getByRole("button", { name: "#MYC", exact: true }).click();
    await page.getByRole("searchbox").fill("Article 249");
    await expect(
      page.locator("[data-article-list] [data-article]"),
    ).toHaveCount(1);
    await expect(page.locator("[data-article-list]")).toContainText(
      "Article 249",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/portfolios/${id}`);
  await page
    .getByRole("combobox", { name: "Editing" })
    .selectOption("articles");
  await expect(page.locator(".entry-editor")).toHaveCount(10);
  await page
    .getByRole("searchbox", { name: "Find an article" })
    .fill("Article 249");
  await expect(page.locator(".entry-editor")).toHaveCount(1);
  await page.locator(".entry-editor > summary").click();
  await page
    .getByRole("textbox", { name: "Publication title *", exact: true })
    .fill("Edited last article");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sites/${id}`) && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await response).ok()).toBe(true);
  const after = await (await page.request.get(`/api/sites/${id}`)).json();
  expect(after.site.draft.sections[1].entries).toHaveLength(250);
  expect(after.site.draft.sections[1].entries[249].title).toBe(
    "Edited last article",
  );
  expect(after.site.draft.sections[1].entries[0].title).toBe("Article 000");
  await page.screenshot({
    path: ".test-data/article-scale-admin.png",
    fullPage: false,
  });
});
