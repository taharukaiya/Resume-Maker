import { test, expect } from "@playwright/test";
import { signInAdmin } from "./admin-session";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";
import { readFile } from "node:fs/promises";
test("fixed portfolio design, archive filters, citations, PDFs and administrator visibility", async ({
  page,
}) => {
  test.setTimeout(180000);
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" },
    slug = `articles-${Date.now()}`;
  const create = await page.request.post("/api/sites", {
    headers,
    data: { name: "Dr. Amina Rahman", slug },
  });
  expect(create.status()).toBe(201);
  const { id } = await create.json();
  const upload = await page.request.post(`/api/sites/${id}/media`, {
    headers,
    multipart: {
      purpose: "article",
      file: {
        name: "research.pdf",
        mimeType: "application/pdf",
        buffer: await readFile("tests/fixtures/article-figure.pdf"),
      },
    },
  });
  expect(upload.status()).toBe(201);
  const { id: mediaId } = await upload.json();
  const uploadedSite = await (
    await page.request.get(`/api/sites/${id}`)
  ).json();
  const uploadedMedia = uploadedSite.media.find(
    (file: { id: string }) => file.id === mediaId,
  );
  expect(uploadedMedia.article_assets.imageIds).toHaveLength(1);
  const figureId = uploadedMedia.article_assets.imageIds[0];
  const doc = emptyDocument("Dr. Amina Rahman");
  doc.profile.headline = "Understanding financial risk through evidence.";
  doc.profile.affiliation = "Financial Risk & Research";
  doc.profile.bio =
    "A researcher studying the connections between institutions and markets.";
  doc.navigation.archivePageSize = 1;
  const first = {
    ...emptyEntry(),
    title: "Coastal resilience",
    authors: "Ada Lovelace; Alan Turing",
    start: "2025-02-09",
    category: "Climate",
    tags: "Evidence, Oceans",
    body: "An editable abstract.",
    fullText: "Methods\n\nObserved evidence and limitations.",
    mediaId,
    coverId: figureId,
    images: [
      {
        mediaId: figureId,
        alt: "Synthetic figure",
        caption: "Administrator-edited figure caption",
      },
    ],
  };
  const second = {
    ...emptyEntry(),
    title: "Financial risk",
    authors: "Amina Rahman",
    start: "2024-01",
    category: "Finance",
    body: "A second research abstract.",
  };
  doc.sections = [
    {
      id: crypto.randomUUID(),
      type: "about",
      title: "About me",
      visible: true,
      intro: "",
      entries: [],
    },
    {
      id: crypto.randomUUID(),
      type: "education",
      title: "Education",
      visible: true,
      intro: "",
      entries: [
        {
          ...emptyEntry(),
          title: "PhD",
          subtitle: "Test University",
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
      entries: [first, second],
    },
  ];
  doc.sections.push({
    id: crypto.randomUUID(),
    type: "publications",
    title: "Research publications",
    visible: true,
    intro: "",
    entries: [
      {
        ...emptyEntry(),
        title: "A separate research paper",
        category: "Finance",
      },
    ],
  });
  let revision = 1;
  const save = async () => {
    const response = await page.request.put(`/api/sites/${id}`, {
      headers,
      data: { document: doc, revision },
    });
    expect(response.status()).toBe(200);
    revision = (await response.json()).revision;
  };
  await save();
  await page.goto(`/api/sites/${id}/preview`);
  await expect(page.locator("body")).toHaveClass("shiba");
  await page.locator('[data-home-category="Finance"]').click();
  await expect(page.locator("[data-home-article]:visible")).toHaveCount(1);
  await expect(page.locator("[data-home-article]:visible")).toContainText(
    "A separate research paper",
  );
  await page.locator('[data-home-category=""]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".test-data/shiba-home-desktop.png",
    fullPage: true,
  });
  await page.goto(`/api/sites/${id}/preview/article`);
  await expect(page.getByRole("heading", { name: "Articles" })).toBeVisible();
  await expect(page.locator("[data-article]:visible")).toHaveCount(1);
  await expect(page.locator("[data-article]:visible")).toContainText(
    "Financial risk",
  );
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("[data-article]:visible")).toContainText(
    "Coastal resilience",
  );
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await page.getByRole("button", { name: "#Oceans", exact: true }).click();
  await expect(page.locator("[data-article]:visible")).toContainText(
    "Coastal resilience",
  );
  await page.getByRole("button", { name: "#Oceans", exact: true }).click();
  await page.getByRole("searchbox").fill("Coastal");
  await expect(page.locator("[data-article]:visible")).toHaveCount(1);
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Finance 1", exact: true }).click();
  await expect(page.locator("[data-article]:visible")).toHaveCount(1);
  await expect(page.locator("[data-article]:visible")).toContainText(
    "Financial risk",
  );
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.test-data/article-archive-${width}.png`,
      fullPage: false,
    });
  }
  await page.goto(`/api/sites/${id}/preview/article/${first.id}`);
  await expect(page.getByRole("heading", { name: first.title })).toBeVisible();
  await expect(page.locator(".article-figure")).toContainText(
    "Administrator-edited figure caption",
  );
  await expect(page.locator(".article-figure img")).toHaveAttribute(
    "alt",
    "Synthetic figure",
  );
  await expect(
    page.getByRole("button", { name: "Copy article URL", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "IEEE", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("2025");
  await expect(page.getByRole("tabpanel")).toContainText("Lovelace");
  await page.getByRole("tab", { name: "APA", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("(2025)");
  await page
    .getByRole("button", { name: "Copy Citation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Copied|Select and copy/ }),
  ).toBeVisible();
  await expect(page.locator(".entry-image")).toHaveCount(1);
  const pdf = await page.request.get(`/api/media/${mediaId}`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const publish = await page.request.post(`/api/sites/${id}/publish`, {
    headers,
    data: { revision },
  });
  expect(publish.status()).toBe(202);
  await expect
    .poll(
      async () => {
        const result = await page.request.get(`/api/sites/${id}`);
        return (await result.json()).site.status;
      },
      { timeout: 45000 },
    )
    .toBe("published");
  await page.goto(`/portfolio/${slug}/article/${first.id}`);
  await page.getByRole("tab", { name: "IEEE", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("2025");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".test-data/shiba-article-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".test-data/shiba-article-mobile.png",
    fullPage: true,
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "",
      "/about",
      "/research",
      "/article",
      `/article/${first.id}`,
    ]) {
      await page.goto(`/portfolio/${slug}${route}`);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator("body")).toHaveClass("shiba");
      if (route.includes(first.id)) {
        await expect(page.locator("[data-copy-url] svg")).toBeVisible();
        await page.getByRole("tab", { name: "MLA", exact: true }).click();
        await expect(page.getByRole("tabpanel")).toContainText("Lovelace");
      }
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-copy-url]")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("[data-copy-url]")).toHaveCSS(
    "transition-duration",
    /0\.18s/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/portfolios/${id}`);
  await expect(
    page
      .getByRole("combobox", { name: "Editing" })
      .locator('option[value="design"]'),
  ).toHaveCount(0);
  await expect(page.getByText("The Shiba design", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("combobox", { name: "Editing" })
    .selectOption("articles");
  await expect(
    page.getByRole("heading", { name: "Articles", exact: true }),
  ).toBeVisible();
  const editor = page.locator(".entry-editor").filter({
    has: page.getByRole("heading", { name: first.title, exact: true }),
  });
  await editor
    .getByRole("button", { name: "Remove cover image", exact: true })
    .click();
  await expect(
    editor.getByRole("combobox", { name: "Article cover", exact: true }),
  ).toHaveValue("");
  await editor
    .getByRole("combobox", { name: "Article cover", exact: true })
    .selectOption(figureId);
  await editor
    .getByText("Article display and citation controls", { exact: true })
    .click();
  await editor
    .getByRole("textbox", { name: "APA citation override", exact: true })
    .fill("Administrator verified citation (2025).");
  await editor
    .getByRole("textbox", { name: "Article author name", exact: true })
    .fill("Guest Author");
  await editor
    .getByRole("checkbox", { name: "Show full article text", exact: true })
    .uncheck();
  const savedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/sites/${id}`) &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await savedResponse).ok()).toBe(true);
  const savedSite = await (await page.request.get(`/api/sites/${id}`)).json();
  revision = savedSite.site.revision;
  const savedArticle = savedSite.site.draft.sections.find(
    (s: { type: string }) => s.type === "articles",
  ).entries[0];
  expect(savedArticle.citationOverrides.APA).toBe(
    "Administrator verified citation (2025).",
  );
  expect(savedArticle.authorDetails.name).toBe("Guest Author");
  expect(savedArticle.display.fullText).toBe(false);
  await page.screenshot({
    path: ".test-data/articles-editor.png",
    fullPage: true,
  });
  await page.request
    .get(`/api/sites/${id}/preview/research`)
    .then((response) => expect(response.status()).toBe(200));
  doc.navigation.articlesEnabled = false;
  await save();
  const hidden = await page.request.get(
    `/api/sites/${id}/preview/article/${first.id}`,
  );
  expect(hidden.status()).toBe(404);
  const home = await page.request.get(`/api/sites/${id}/preview`);
  expect(await home.text()).not.toContain(first.title);
  expect(
    (
      await page.request.post(`/api/sites/${id}/publish`, {
        headers,
        data: { revision },
      })
    ).status(),
  ).toBe(202);
  await expect
    .poll(
      async () => {
        const result = await page.request.get(`/api/sites/${id}`);
        return (await result.json()).site.status;
      },
      { timeout: 45000 },
    )
    .toBe("published");
  expect(
    (await page.request.get(`/portfolio/${slug}/article/${first.id}`)).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(`/portfolio/${slug}/assets/${mediaId}.pdf`)
    ).status(),
  ).toBe(404);
});

test("uploaded metadata and figures reach an editable draft only after extraction", async ({
  page,
}) => {
  await signInAdmin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const headers = { origin: "http://localhost:3100" };
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Metadata review", slug: `metadata-${Date.now()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const upload = await page.request.post(`/api/sites/${id}/media`, {
    headers,
    multipart: {
      purpose: "article",
      file: {
        name: "metadata.pdf",
        mimeType: "application/pdf",
        buffer: await readFile("tests/fixtures/article-metadata.pdf"),
      },
    },
  });
  expect(upload.status()).toBe(201);
  const { id: mediaId } = await upload.json();
  const snapshot = await (await page.request.get(`/api/sites/${id}`)).json();
  const file = snapshot.media.find(
    (item: { id: string }) => item.id === mediaId,
  );
  expect(file.article_metadata.authors).toBe("Ada Lovelace; Alan Turing");
  expect(file.article_metadata.date).toBe("2025-02-09");
  expect(file.article_metadata.abstract).toContain(
    "We examined coastal observations.",
  );
  expect(file.article_metadata.abstract).not.toContain("body text");
  expect(file.article_assets.imageIds).toHaveLength(1);
  let pending = true;
  await page.route(`**/api/sites/${id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    if (pending)
      json.jobs.push({
        id: "pending-test",
        created_at: new Date().toISOString(),
        error: null,
        kind: "abstract",
        status: "running",
        media_id: mediaId,
      });
    await route.fulfill({ response, json });
  });
  await page.goto(`/studio/portfolios/${id}`);
  await page.getByRole("combobox", { name: "Editing" }).selectOption("media");
  await expect(
    page.getByRole("button", { name: "Add article draft", exact: true }),
  ).toBeDisabled();
  pending = false;
  await expect(
    page.getByRole("button", { name: "Add article draft", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Add article draft", exact: true })
    .click();
  const editor = page.locator(".entry-editor");
  await expect(
    editor.getByRole("textbox", { name: "Authors", exact: true }),
  ).toHaveValue("Ada Lovelace; Alan Turing");
  await expect(
    editor.getByRole("textbox", { name: "Publication date", exact: true }),
  ).toHaveValue("2025-02-09");
  await expect(
    editor.getByRole("textbox", {
      name: "Abstract or research summary",
      exact: true,
    }),
  ).toHaveValue(/We examined coastal observations/);
  await expect(
    editor.getByRole("combobox", { name: "Article cover", exact: true }),
  ).toHaveValue(file.article_assets.imageIds[0]);
  await editor
    .getByRole("textbox", { name: "Authors", exact: true })
    .fill("Verified Author; Second Author");
  await editor
    .getByRole("textbox", { name: "Publication date", exact: true })
    .fill("2024-12-15");
  await editor
    .getByRole("textbox", { name: "Abstract or research summary", exact: true })
    .fill("Administrator verified abstract.");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/sites/${id}`) &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  const result = await (await page.request.get(`/api/sites/${id}`)).json();
  const entry = result.site.draft.sections.find(
    (section: { type: string }) => section.type === "articles",
  ).entries[0];
  expect(entry.authors).toBe("Verified Author; Second Author");
  expect(entry.start).toBe("2024-12-15");
  expect(entry.body).toBe("Administrator verified abstract.");
  expect(entry.images[0].mediaId).toBe(file.article_assets.imageIds[0]);
  expect(result.site.status).not.toBe("published");
});
