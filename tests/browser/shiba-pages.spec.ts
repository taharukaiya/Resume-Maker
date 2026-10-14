import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { signInAdmin } from "./admin-session";
import {
  emptyDocument,
  emptyEntry,
  type Section,
} from "../../src/modules/portfolios/schema";
test("reference About and Contact layouts, pipe titles and working collaboration form", async ({
  page,
}) => {
  test.setTimeout(180000);
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" },
    slug = `reference-pages-${Date.now()}`;
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Dr. Amina Rahman", slug },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const upload = await page.request.post(`/api/sites/${id}/media`, {
    headers,
    multipart: {
      purpose: "article",
      file: {
        name: "fixture.pdf",
        mimeType: "application/pdf",
        buffer: await readFile("tests/fixtures/article-figure.pdf"),
      },
    },
  });
  expect(upload.status()).toBe(201);
  const file = await upload.json();
  const library = await (await page.request.get(`/api/sites/${id}`)).json();
  const figure = library.media.find(
    (item: { id: string }) => item.id === file.id,
  ).article_assets.imageIds[0];
  const doc = emptyDocument("Dr. Amina Rahman");
  doc.profile.portraitId = figure;
  doc.profile.logoId = figure;
  doc.profile.cvId = file.id;
  doc.profile.headline = "Research, evidence and impact";
  doc.profile.aboutHeadline = "Bridging research with evidence and impact";
  doc.profile.aboutBio =
    "I study how communities respond to changing environments. My research connects institutions, public policy and empirical evidence.\n\nI collaborate across disciplines to develop transparent methods and practical insights.";
  doc.profile.collaborationNote =
    "Open to collaboration on climate, policy and data analysis.";
  doc.profile.officeHours = "Tuesday | 10am to noon";
  doc.profile.mailingAddress = "Example University\nExample City";
  doc.profile.links = [
    { label: "Google Scholar", url: "https://scholar.google.com/" },
  ];
  const section = (
    type: Section["type"],
    title: string,
    entries: Section["entries"] = [],
  ): Section => ({
    id: crypto.randomUUID(),
    type,
    title,
    visible: true,
    intro: "",
    entries,
  });
  doc.sections = [
    section("about", "About Me"),
    section("education", "Education", [
      {
        ...emptyEntry(),
        title: "PhD in Environmental Research",
        subtitle: "Example University",
        start: "2020",
        end: "2024",
        body: "Studied transparent methods for evaluating institutional responses to climate change.",
      },
    ]),
    section("experience", "Experience", [
      {
        ...emptyEntry(),
        title: "Research Fellow",
        subtitle: "Example Research Institute",
        start: "2024",
        current: true,
        body: "Collaborating on evidence-based climate and policy research.",
      },
    ]),
    section(
      "interests",
      "Research Interests",
      ["Climate resilience", "Policy analytics", "Transparent methods"].map(
        (title) => ({
          ...emptyEntry(),
          title,
          body: "Research questions informed by empirical evidence and interdisciplinary collaboration.",
        }),
      ),
    ),
    section("conferences", "Conference Participated", [
      {
        ...emptyEntry(),
        title: "Research Methods Conference",
        subtitle: "Example University",
        start: "2025",
      },
    ]),
    section("awards", "Honors & Awards", [
      {
        ...emptyEntry(),
        title: "Research Excellence Award",
        subtitle: "Example University",
        start: "2024",
      },
    ]),
    section("publications", "My Publication", [
      {
        ...emptyEntry(),
        title: "Evidence-based climate policy",
        status: "published",
        start: "2025",
        body: "A synthetic research abstract for software verification.",
      },
    ]),
    section(
      "contact",
      "Contact",
      ["Climate research", "Policy collaboration", "Research methods"].map(
        (title) => ({
          ...emptyEntry(),
          title,
          body: "Collaborate on empirical research, transparent analysis and practical questions.",
        }),
      ),
    ),
  ];
  const saved = await page.request.put(`/api/sites/${id}`, {
    headers,
    data: { document: doc, revision: 1 },
  });
  expect(saved.status()).toBe(200);
  const { revision } = await saved.json();
  const published = await page.request.post(`/api/sites/${id}/publish`, {
    headers,
    data: { revision },
  });
  expect(published.status()).toBe(202);
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`/api/sites/${id}`)).json()).site.status,
      { timeout: 45000 },
    )
    .toBe("published");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/portfolio/${slug}/about`);
  await expect(page).toHaveTitle("About Me | Dr. Amina Rahman");
  await expect(
    page.getByRole("heading", { name: doc.profile.aboutHeadline }),
  ).toBeVisible();
  await expect(page.locator(".about-photo img")).toBeVisible();
  await expect(page.locator(".about-history")).toContainText("Education");
  await expect(page.locator(".about-history")).toContainText("Experience");
  expect(
    await page
      .locator(".about-biography h1")
      .evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe("36px");
  await expect(page.locator(".about-cta")).toHaveCSS(
    "background-color",
    "rgb(20, 71, 230)",
  );
  await expect(page.locator(".about-awards-group")).toContainText(
    "Research Excellence Award",
  );
  await page.screenshot({
    path: ".test-data/about-reference-desktop.png",
    fullPage: false,
  });
  await page.goto(`/portfolio/${slug}/research`);
  await expect(page).toHaveTitle("Research Archive | Dr. Amina Rahman");
  await expect(page.locator("[data-archive]")).toBeVisible();
  await expect(page.locator("[data-article]:visible")).toHaveCount(1);
  await page.goto(`/portfolio/${slug}/contact`);
  await expect(page).toHaveTitle("Contact | Dr. Amina Rahman");
  await page
    .getByRole("button", { name: /Climate research Collaborate/ })
    .click();
  await expect(page.locator('input[name="subject"]')).toHaveValue(
    "Climate research",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: ".test-data/contact-reference-desktop.png",
    fullPage: false,
  });
  for (const route of ["about", "contact", "research"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/portfolio/${slug}/${route}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `No horizontal overflow on ${route}`,
    ).toBe(true);
    await page.screenshot({
      path: `.test-data/${route}-reference-mobile.png`,
      fullPage: true,
    });
  }
  await page.goto(`/portfolio/${slug}/contact`);
  await page.locator('input[name="name"]').fill("Test Visitor");
  await page.locator('input[name="email"]').fill("visitor@example.test");
  await page
    .locator('input[name="subject"]')
    .fill("Administrator-editable topic");
  await page
    .locator('textarea[name="message"]')
    .fill("I would like to discuss a potential collaboration.");
  await page.getByRole("button", { name: "Send Inquiry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: doc.labels.receivedTitle }),
  ).toBeVisible();
  const inbox = await (await page.request.get("/api/inquiries")).json();
  expect(
    inbox.inquiries.some((item: { message: string }) =>
      item.message.includes("Subject: Administrator-editable topic"),
    ),
  ).toBe(true);
});
