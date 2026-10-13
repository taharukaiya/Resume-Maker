import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signInAdmin } from "./admin-session";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";

const headers = { origin: "http://localhost:3100" };

test("cancelling or blocking the portrait model preserves the original photo", async ({
  page,
}) => {
  test.setTimeout(90000);
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: {
      name: "Photo recovery fixture",
      slug: `photo-recovery-${Date.now()}`,
    },
  });
  const { id } = await created.json();
  let release!: () => void;
  let hold = true;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("https://huggingface.co/**", async (route) => {
    if (hold) await gate;
    await route.abort().catch(() => {});
  });
  try {
    await page.goto(`/studio/portfolios/${id}`);
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#2254a5" },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel("Upload profile photo", { exact: true })
      .setInputFiles({ name: "original.png", mimeType: "image/png", buffer });
    await page
      .getByRole("button", { name: "Cancel background removal" })
      .click();
    await expect(page.locator('.portrait-fields [role="alert"]')).toContainText(
      "Background removal cancelled",
    );
    hold = false;
    release();
    const original = await page
      .getByLabel("Profile photo", { exact: true })
      .inputValue();
    await expect(page.getByAltText("Selected profile photo")).toBeVisible();
    await page
      .getByRole("button", { name: "Remove background from selected photo" })
      .click();
    await expect(page.locator('.portrait-fields [role="alert"]')).toContainText(
      "The photo model could not download or process this image",
      { timeout: 45000 },
    );
    expect(
      await page.getByLabel("Profile photo", { exact: true }).inputValue(),
    ).toBe(original);
    expect(
      (await (await page.request.get(`/api/sites/${id}`)).json()).media,
    ).toHaveLength(1);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    expect(
      (await (await page.request.get(`/api/sites/${id}`)).json()).site.draft
        .profile.portraitId,
    ).toBe(original);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByAltText("Selected profile photo").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".test-data/portrait-editor-mobile.png",
      animations: "disabled",
    });
  } finally {
    release();
    await page.request.delete(`/api/sites/${id}`, { headers });
  }
});

test("transparent portraits skip model downloads, and guided publishing saves changes", async ({
  page,
}) => {
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Portrait workflow fixture", slug: `portrait-${Date.now()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const draft = emptyDocument("Portrait workflow fixture");
  draft.sections = [
    {
      id: crypto.randomUUID(),
      type: "education",
      title: "Education",
      visible: true,
      intro: "",
      entries: [
        {
          ...emptyEntry(),
          title: "MSc",
          subtitle: "Test university",
          start: "2020",
          end: "2022",
        },
      ],
    },
  ];
  expect(
    (
      await page.request.put(`/api/sites/${id}`, {
        headers,
        data: { revision: 1, document: draft },
      })
    ).status(),
  ).toBe(200);
  const downloads: string[] = [];
  page.context().on("request", (request) => {
    if (/huggingface\.co|hf\.co/.test(request.url()))
      downloads.push(request.url());
  });
  try {
    await page.goto(`/studio/portfolios/${id}`);
    await page.getByRole("tab", { name: "Profile", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Academic sections", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Home");
    await expect(
      page.getByRole("tab", { name: "Profile", exact: true }),
    ).toBeFocused();
    const buffer = await sharp({
      create: {
        width: 240,
        height: 320,
        channels: 4,
        background: { r: 30, g: 50, b: 90, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="240" height="320"><circle cx="120" cy="160" r="60" fill="#2254a5"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
    await page
      .getByLabel("Upload profile photo", { exact: true })
      .setInputFiles({
        name: "already-transparent.png",
        mimeType: "image/png",
        buffer,
      });
    await expect(
      page.getByText(
        "This photo already has transparency. Its background was left unchanged.",
      ),
    ).toBeVisible({ timeout: 60000 });
    expect(downloads).toEqual([]);
    expect(
      (await (await page.request.get(`/api/sites/${id}`)).json()).media,
    ).toHaveLength(1);
    await page
      .getByLabel("Biography", { exact: true })
      .fill("A biography saved through the guided workflow.");
    await page
      .getByRole("button", { name: "Save & continue to Academic sections" })
      .click();
    await expect(
      page.getByRole("tab", { name: "Academic sections", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      (await (await page.request.get(`/api/sites/${id}`)).json()).site.draft
        .profile.bio,
    ).toContain("guided workflow");
    await page.getByRole("tab", { name: "Profile", exact: true }).click();
    await page
      .getByLabel("Biography", { exact: true })
      .fill("A revised biography saved at publication.");
    await page
      .getByRole("tab", { name: "Review & publish", exact: true })
      .click();
    await page.getByText("Connect a personal domain", { exact: true }).click();
    await expect(
      page.getByText("Register the domain", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Connect hosting & HTTPS", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save and publish draft", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/sites/${id}`)).json())
            .publishedUrl,
        { timeout: 30000 },
      )
      .toBeTruthy();
    const state = await (await page.request.get(`/api/sites/${id}`)).json();
    expect(state.publishedDocument.profile.bio).toContain("revised biography");
    await page.goto(state.publishedUrl);
    await expect(page.locator(".page-overview")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toContainText("Let’s connect.");
    await expect(page.getByRole("contentinfo")).toContainText(
      "Portrait workflow fixture",
    );
  } finally {
    await page.request.post(`/api/sites/${id}/unpublish`, { headers });
    await page.request.delete(`/api/sites/${id}`, { headers });
  }
});

test("real MODNet portrait processing retains the original and produces a transparent image", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_PORTRAIT_MODEL_TEST !== "true",
    "Opt-in downloads the real free model and requires .test-data/portrait-source.jpg",
  );
  test.setTimeout(300000);
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers,
    data: {
      name: "Portrait model verification",
      slug: `portrait-model-${Date.now()}`,
    },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      console.log("Browser:", message.text().slice(0, 300));
  });
  page
    .context()
    .on("requestfailed", (request) =>
      console.log(
        "Request failed:",
        request.url().split("?")[0],
        request.failure()?.errorText,
      ),
    );
  try {
    await page.goto(`/studio/portfolios/${id}`);
    await page
      .getByLabel("Upload profile photo", { exact: true })
      .setInputFiles(".test-data/portrait-source.jpg");
    const ready = page.getByText("Transparent portrait selected.", {
      exact: false,
    });
    await expect(
      ready.or(page.locator('.portrait-fields [role="alert"]')),
    ).toBeVisible({ timeout: 210000 });
    await expect(ready).toBeVisible();
    const selected = await page
      .getByLabel("Profile photo", { exact: true })
      .inputValue();
    const response = await page.request.get(`/api/media/${selected}`);
    const stats = await sharp(await response.body()).stats();
    expect(stats.isOpaque).toBe(false);
    expect(stats.channels[3].min).toBe(0);
    expect(stats.channels[3].max).toBe(255);
    const state = await (await page.request.get(`/api/sites/${id}`)).json();
    expect(state.media).toHaveLength(2);
    await page
      .getByRole("button", { name: "Use original", exact: true })
      .click();
    expect(
      await page.getByLabel("Profile photo", { exact: true }).inputValue(),
    ).not.toBe(selected);
    await page
      .getByRole("button", { name: "Use transparent version", exact: true })
      .click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await page.screenshot({
      path: ".test-data/portrait-processing-editor.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(`/api/sites/${id}/preview`);
    await page.screenshot({
      path: ".test-data/portrait-processing-public.png",
      fullPage: true,
      animations: "disabled",
    });
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/sites/${id}`, { headers });
  }
});
