import { test, expect } from "@playwright/test";
import { signInAdmin } from "./admin-session";
test("admin can edit, reorder and remove personal cards and control motion", async ({
  page,
}) => {
  await signInAdmin(page);
  const created = await page.request.post("/api/sites", {
    headers: { origin: "http://localhost:3100" },
    data: { name: "Personal content test", slug: `personal-${Date.now()}` },
  });
  const { id } = await created.json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/portfolios/${id}`);
  await page
    .getByRole("textbox", { name: "Personal quote", exact: true })
    .fill("Questions lead to discoveries.");
  await page
    .getByRole("textbox", { name: "Quote attribution", exact: true })
    .fill("Personal motto");
  await page
    .getByRole("textbox", { name: "Cards heading", exact: true })
    .fill("My interests");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Card 1 title", exact: true })
    .fill("Research");
  await page
    .getByRole("textbox", { name: "Card 1 text", exact: true })
    .fill("Collaborative research and evidence.");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Card 2 title", exact: true })
    .fill("Education");
  await page
    .getByRole("combobox", { name: "Card 2 icon", exact: true })
    .selectOption("education");
  await page
    .getByRole("button", { name: "Move card 2 up", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Card 1 title", exact: true }),
  ).toHaveValue("Education");
  await page
    .getByRole("button", { name: "Remove card 2", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Motion effects", exact: true })
    .selectOption("none");
  await page
    .getByRole("checkbox", { name: "Soft animated background", exact: true })
    .uncheck();
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sites/${id}`) && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Personal quote", exact: true }),
  ).toHaveValue("Questions lead to discoveries.");
  await expect(
    page.getByRole("textbox", { name: "Card 1 title", exact: true }),
  ).toHaveValue("Education");
  await page.goto(`/api/sites/${id}/preview`);
  await expect(page.locator(".personality-card")).toHaveCount(1);
  await expect(page.locator("body")).toHaveAttribute("data-effects", "none");
  await expect(page.locator("body")).toHaveAttribute(
    "data-background",
    "false",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".personality-quote")).toBeVisible();
});
