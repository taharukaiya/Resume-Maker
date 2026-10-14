import { test, expect } from "@playwright/test";
import { signInAdmin } from "./admin-session";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";
import { textPdf } from "../pdf-fixture";
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
        buffer: textPdf([
          "Research document fixture.",
          "Methods, results and conclusions for software testing.",
        ]),
      },
    },
  });
  expect(upload.status()).toBe(201);
  const { id: mediaId } = await upload.json();
  const doc = emptyDocument("Dr. Amina Rahman");
  doc.profile.headline = "Understanding financial risk through evidence.";
  doc.profile.affiliation = "Financial Risk & Research";
  doc.profile.bio =
    "A researcher studying the connections between institutions and markets.";
  const first = {
    ...emptyEntry(),
    title: "Coastal resilience",
    authors: "Ada Lovelace; Alan Turing",
    start: "2025-02-09",
    category: "Climate",
    body: "An editable abstract.",
    fullText: "Methods\n\nObserved evidence and limitations.",
    mediaId,
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
      type: "publications",
      title: "Research Articles",
      visible: true,
      intro: "",
      entries: [first, second],
    },
  ];
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
    second.title,
  );
  await page.locator('[data-home-category=""]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".test-data/shiba-home-desktop.png",
    fullPage: true,
  });
  await page.goto(`/api/sites/${id}/preview/article`);
  await expect(
    page.getByRole("heading", { name: "Research Archive" }),
  ).toBeVisible();
  await expect(page.locator("[data-article]:visible")).toHaveCount(2);
  await page.getByRole("searchbox").fill("Coastal");
  await expect(page.locator("[data-article]:visible")).toHaveCount(1);
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Finance 1", exact: true }).click();
  await expect(page.locator("[data-article]:visible")).toHaveCount(1);
  await expect(page.locator("[data-article]:visible")).toContainText(
    "Financial risk",
  );
  await page.goto(`/api/sites/${id}/preview/article/${first.id}`);
  await expect(page.getByRole("heading", { name: first.title })).toBeVisible();
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
  await page.goto(`/studio/portfolios/${id}`);
  await page
    .getByRole("combobox", { name: "Editing", exact: true })
    .selectOption("design");
  await expect(
    page.getByRole("heading", { name: "The Shiba design" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Six ways to tell your story." }),
  ).toHaveCount(0);
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
