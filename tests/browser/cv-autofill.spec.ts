import { test, expect } from "@playwright/test";
import { signInAdmin } from "./admin-session";
import type { CvExtraction } from "../../src/modules/portfolios/cv-import";
import sharp from "sharp";

test("CV completion fills editable fields and links across tabs, then publishes personal favicons", async ({
  page,
}) => {
  test.setTimeout(180000);
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" };
  const slug = `autofill-${Date.now()}`;
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Amina Rahman", slug },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const mediaId = crypto.randomUUID();
  let jobId = crypto.randomUUID();
  let status = "idle";
  const extracted: CvExtraction = {
    profile: {
      name: "Dr. Amina Rahman",
      headline: "Research scientist",
      affiliation: "Example University",
      bio: "My research examines environmental systems.",
      location: "Dhaka",
      email: "amina@example.org",
      links: [
        { label: "Code", url: "https://github.com/amina-example" },
        { label: "LinkedIn", url: "https://linkedin.com/in/amina-example" },
      ],
    },
    sections: [
      {
        type: "education",
        title: "Education",
        entries: [
          {
            title: "MSc Environmental Science",
            subtitle: "Example University",
            body: "Thesis on environmental systems.",
            start: "2020",
            end: "2022",
            current: false,
            url: "",
            tags: "",
            authors: "",
            doi: "",
            status: "",
          },
        ],
      },
    ],
    warnings: ["Check extracted facts against the CV."],
  };
  await page.route("**/api/integrations", (route) =>
    route.fulfill({ json: { ai: true, aiProvider: "openai" } }),
  );
  await page.route(`**/api/media/${mediaId}/cv-import`, (route) => {
    status = "queued";
    return route.fulfill({ status: 202, json: { jobId } });
  });
  await page.route(`**/api/sites/${id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    body.media.push({
      id: mediaId,
      filename: "synthetic-cv.pdf",
      mime: "application/pdf",
      cv_import: status === "done" || status === "failed" ? extracted : null,
    });
    if (status !== "idle")
      body.jobs.unshift({
        id: jobId,
        kind: "cv-import",
        status,
        error: status === "failed" ? "Test extraction failed" : null,
      });
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/studio/portfolios/${id}`);
  await page.getByLabel("CV or resume PDF").selectOption(mediaId);
  await page.getByLabel("Also replace existing profile text").check();
  await page
    .getByRole("button", { name: "Extract details", exact: true })
    .click();
  await expect(
    page.getByText(
      "Extracting CV. Keep this editor open; details will fill automatically when ready.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("Profession or headline", { exact: true })
    .fill("Edited while AI runs");
  await page
    .getByRole("tab", { name: "Academic sections", exact: true })
    .click();
  status = "done";
  await expect(
    page.locator("summary").filter({ hasText: "Education" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(page.getByLabel("Full name *", { exact: true })).toHaveValue(
    "Dr. Amina Rahman",
  );
  await expect(
    page.getByLabel("Profession or headline", { exact: true }),
  ).toHaveValue("Edited while AI runs");
  await expect(
    page.getByLabel("Button label", { exact: true }).first(),
  ).toHaveValue("GitHub");
  await expect(page.getByLabel("Button label", { exact: true })).toHaveCount(2);
  await page.getByLabel("Button label", { exact: true }).nth(1).fill("Website");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  let saved = await (await page.request.get(`/api/sites/${id}`)).json();
  expect(saved.site.draft.profile.links[1].label).toBe("Website");
  expect(
    saved.site.draft.sections.find(
      (s: { type: string }) => s.type === "education",
    ).entries,
  ).toHaveLength(1);
  // A failed retry must not apply the older result still stored on the file.
  jobId = crypto.randomUUID();
  await page
    .getByRole("button", { name: "Extract details", exact: true })
    .click();
  await expect(
    page.getByText(
      "Extracting CV. Keep this editor open; details will fill automatically when ready.",
    ),
  ).toBeVisible();
  status = "failed";
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Test extraction failed" })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByLabel("Profession or headline", { exact: true }),
  ).toHaveValue("Edited while AI runs");
  await expect(page.getByLabel("Button label", { exact: true })).toHaveCount(2);
  await page.screenshot({
    path: ".test-data/cv-autofill-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".test-data/cv-autofill-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    (
      await page.request.post(`/api/sites/${id}/publish`, {
        headers,
        data: { revision: saved.site.revision },
      })
    ).ok(),
  ).toBeTruthy();
  await expect
    .poll(async () => (await page.request.get(`/portfolio/${slug}`)).status(), {
      timeout: 30000,
    })
    .toBe(200);
  const published = await (await page.request.get(`/portfolio/${slug}`)).text();
  expect(published).toMatch(/rel="icon"[^>]+favicon\.svg/);
  const icon = await page.request.get(`/portfolio/${slug}/favicon.svg`);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  expect(await icon.text()).toContain(">AR</text>");
  // A real uploaded portrait produces a tiny PNG in the immutable release.
  const photo = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "#164e63" },
  })
    .png()
    .toBuffer();
  const upload = await page.request.post(`/api/sites/${id}/media`, {
    headers,
    multipart: {
      purpose: "image",
      file: {
        name: "synthetic-portrait.png",
        mimeType: "image/png",
        buffer: photo,
      },
    },
  });
  expect(upload.ok()).toBeTruthy();
  saved = await (await page.request.get(`/api/sites/${id}`)).json();
  saved.site.draft.profile.portraitId = (await upload.json()).id;
  const update = await page.request.put(`/api/sites/${id}`, {
    headers,
    data: { revision: saved.site.revision, document: saved.site.draft },
  });
  expect(update.ok()).toBeTruthy();
  saved = await (await page.request.get(`/api/sites/${id}`)).json();
  expect(
    (
      await page.request.post(`/api/sites/${id}/publish`, {
        headers,
        data: { revision: saved.site.revision },
      })
    ).ok(),
  ).toBeTruthy();
  await expect
    .poll(
      async () =>
        (await page.request.get(`/portfolio/${slug}/favicon.png`)).status(),
      { timeout: 30000 },
    )
    .toBe(200);
  const png = await page.request.get(`/portfolio/${slug}/favicon.png`);
  expect(png.headers()["content-type"]).toBe("image/png");
  const dimensions = await sharp(await png.body()).metadata();
  expect([dimensions.width, dimensions.height]).toEqual([64, 64]);
  expect(await (await page.request.get(`/portfolio/${slug}`)).text()).toContain(
    "favicon.png",
  );
});
