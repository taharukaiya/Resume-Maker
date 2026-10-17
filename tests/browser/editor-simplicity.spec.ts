import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { signInAdmin } from "./admin-session";

test("simple editor keeps optional settings away and routes research imports correctly", async ({
  page,
}) => {
  await signInAdmin(page);
  const headers = { origin: "http://localhost:3100" };
  const response = await page.request.post("/api/sites", {
    headers,
    data: { name: "Editorial review", slug: `editor-review-${Date.now()}` },
  });
  const { id } = await response.json();
  await page.request.post(`/api/sites/${id}/media`, {
    headers,
    multipart: {
      purpose: "article",
      file: {
        name: "review-paper.pdf",
        mimeType: "application/pdf",
        buffer: await readFile("tests/fixtures/article-metadata.pdf"),
      },
    },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/studio/portfolios/${id}`);
  await expect(
    page.getByRole("textbox", { name: "Homepage heading", exact: true }),
  ).toBeHidden();
  await page
    .getByText("Customize page introductions and photo position", {
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Homepage heading", exact: true })
    .fill("A clear introduction");
  await page.getByRole("tab", { name: "Research", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Upload a document / extract details",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("list", { name: "Article upload steps" }),
  ).toBeVisible();
  await expect(
    page.getByText(/AI sends documents to Google Gemini/),
  ).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Find a file" })
    .fill("review-paper");
  await page
    .getByRole("button", { name: "Add research draft", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Research", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("textbox", {
      name: "Abstract or research summary",
      exact: true,
    }),
  ).toHaveValue(/We examined coastal/);
  await expect(
    page.getByRole("textbox", { name: "DOI", exact: true }),
  ).toBeHidden();
  await page
    .getByText("Publication details and citation information", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "DOI", exact: true })
    .fill("10.1234/review");
  await page
    .getByText("Publication details and citation information", { exact: true })
    .click();
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sites/${id}`) && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  const result = await (await page.request.get(`/api/sites/${id}`)).json();
  expect(result.site.draft.profile.heroHeadline).toBe("A clear introduction");
  expect(
    result.site.draft.sections.find(
      (s: { type: string }) => s.type === "publications",
    ).entries[0].doi,
  ).toBe("10.1234/review");
  await page.screenshot({ path: ".test-data/editor-simple-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({ path: ".test-data/editor-simple-mobile.png" });
});
