import { test, expect } from "@playwright/test";
import { signInAdmin } from "./admin-session";
import path from "node:path";

test("admin removes and restores CV uploads without losing unsaved edits on desktop and mobile", async ({
  page,
}) => {
  test.setTimeout(180000);
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" };
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name: "Upload review", slug: `upload-review-${Date.now()}` },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  await page.goto(`/studio/portfolios/${id}`);
  await page
    .getByLabel("Upload a CV", { exact: true })
    .setInputFiles(path.resolve("tests/fixtures/article-metadata.pdf"));
  await expect(
    page.getByText("CV uploaded. Choose Extract details when ready."),
  ).toBeVisible();
  await page
    .getByLabel("Full name *", { exact: true })
    .fill("Unsaved name stays");
  await page
    .getByRole("button", { name: "Remove selected upload", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove upload", exact: true })
    .click();
  await expect(
    page.getByText(
      "Upload removed. You can restore it beside the upload controls.",
    ),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("CV or resume PDF")
      .locator("option", { hasText: "article-metadata.pdf" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Full name *", { exact: true })).toHaveValue(
    "Unsaved name stays",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Manage uploaded documents", { exact: true }).click();
  await page.getByText("Removed documents (1)", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Restore upload article-metadata.pdf",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByLabel("CV or resume PDF")
      .locator("option", { hasText: "article-metadata.pdf" }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Full name *", { exact: true })).toHaveValue(
    "Unsaved name stays",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".test-data/upload-removal-mobile.png",
    fullPage: true,
  });
});
