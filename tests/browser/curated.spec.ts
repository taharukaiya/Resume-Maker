import { expect, test } from "@playwright/test";
import { signInAdmin } from "./admin-session";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";
import { signatureLooks } from "../../src/modules/portfolios/design";

test("six curated designs, automatic search preview, publications workflow and mobile layouts", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" };
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Dr. Amina Rahman", slug: `curated-${Date.now()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  await page.goto(`/studio/portfolios/${id}`);
  await page
    .getByRole("tab", { name: "Review & publish", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish approved draft", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Academic sections: add at least one visible education entry.",
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Design", exact: true }).click();
  await expect(page.locator(".curated-card")).toHaveCount(6);
  await expect(page.locator("input[type=color]")).toHaveCount(0);
  await page.screenshot({
    path: ".test-data/curated-editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("tab", { name: "Search & sharing", exact: true })
    .click();
  await expect(page.locator(".search-preview")).toContainText(
    "Dr. Amina Rahman",
  );
  await expect(
    page.getByLabel("Social sharing title", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByText("Customize search & sharing (optional)", { exact: true })
    .click();
  await expect(
    page.getByLabel("Social sharing title", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Publications", exact: true }).click();
  await page
    .getByLabel("Add section", { exact: true })
    .selectOption("publications");
  await page
    .getByRole("button", { name: "Add publication", exact: true })
    .click();
  await expect(
    page.getByLabel("Publication title *", { exact: true }),
  ).toBeVisible();
  const doc = emptyDocument("Dr. Amina Rahman");
  doc.profile.headline = "Climate science for resilient communities";
  doc.profile.affiliation = "Environmental Systems Laboratory";
  doc.profile.bio =
    "I study how cities and coastal communities adapt to environmental change. My work brings together field research, open data and collaborative science to inform decisions about our shared future.";
  doc.profile.email = "amina@example.org";
  doc.profile.location = "Dhaka, Bangladesh";
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
          title: "PhD in Environmental Science",
          subtitle: "University research programme",
          start: "2022",
          current: true,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      type: "publications",
      title: "Selected publications",
      visible: true,
      intro: "",
      entries: [
        {
          ...emptyEntry(),
          title: "Understanding coastal resilience",
          subtitle: "Environmental research",
          authors: "A. Rahman",
          start: "2025",
          body: "A study of the relationship between local evidence, community participation and climate adaptation. We combine field observations with spatial analysis to examine how research can inform long-term decisions.",
          tags: "Climate, Open data",
          abstractSource: "original",
        },
      ],
    },
  ];
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
    reducedMotion: "reduce",
  });
  const preview = await context.newPage();
  try {
    let revision = 1;
    for (const look of signatureLooks) {
      doc.theme = { ...doc.theme, ...look.theme };
      const saved = await page.request.put(`/api/sites/${id}`, {
        headers,
        data: { document: doc, revision },
      });
      expect(saved.status()).toBe(200);
      revision = (await saved.json()).revision;
      await preview.setViewportSize({ width: 1440, height: 1000 });
      await preview.goto(`/api/sites/${id}/preview`);
      await expect(
        preview.getByRole("heading", { name: doc.profile.name, exact: true }),
      ).toBeVisible();
      await preview.screenshot({
        path: `.test-data/curated-${look.theme.style}-desktop.png`,
        fullPage: true,
        animations: "disabled",
      });
      await preview.setViewportSize({ width: 390, height: 844 });
      expect(
        await preview.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await preview.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(
        preview.getByRole("navigation", {
          name: "Mobile navigation",
          exact: true,
        }),
      ).toBeVisible();
      await preview
        .getByRole("navigation", { name: "Mobile navigation", exact: true })
        .getByRole("link", { name: "Research", exact: true })
        .click();
      await expect(
        preview.getByRole("heading", {
          name: "Understanding coastal resilience",
          exact: true,
        }),
      ).toBeVisible();
      await preview.screenshot({
        path: `.test-data/curated-${look.theme.style}-mobile.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await context.close();
  }
});
