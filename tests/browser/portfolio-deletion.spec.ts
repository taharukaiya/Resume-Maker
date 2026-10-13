import { expect, test } from "@playwright/test";
import { signInAdmin } from "./admin-session";
import { emptyDocument, emptyEntry } from "../../src/modules/portfolios/schema";

const headers = { origin: "http://localhost:3100" };

test("portfolio cards offer accessible deletion with cancellation and typed confirmation on mobile", async ({
  page,
}) => {
  await signInAdmin(page);
  const name = "Disposable card portfolio";
  const slug = `delete-card-${Date.now()}`;
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name, slug },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio/portfolios");
  await page.getByLabel("Search portfolios").fill(slug);
  const card = page.getByRole("article", { name, exact: true });
  const trigger = card.getByRole("button", {
    name: `Delete portfolio for ${name}`,
  });
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "Delete portfolio?" });
  const confirm = dialog.getByRole("button", {
    name: "Permanently delete portfolio",
  });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByLabel(`Type ${slug} to confirm deletion`)
    .fill("wrong-address");
  await expect(confirm).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect((await page.request.get(`/api/sites/${id}`)).status()).toBe(200);
  await trigger.click();
  await dialog.getByLabel(`Type ${slug} to confirm deletion`).fill(slug);
  await page.screenshot({
    path: ".test-data/portfolio-delete-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  await expect(card).not.toBeVisible();
  await expect(
    page.getByText(`${name}’s portfolio was deleted.`),
  ).toBeVisible();
  expect((await page.request.get(`/api/sites/${id}`)).status()).toBe(404);
});

test("editor header can delete a published portfolio and remove its public page", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signInAdmin(page);
  const name = "Disposable live portfolio";
  const slug = `delete-live-${Date.now()}`;
  const created = await page.request.post("/api/sites", {
    headers,
    data: { name, slug },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const document = emptyDocument(name);
  document.sections = [
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
  const saved = await page.request.put(`/api/sites/${id}`, {
    headers,
    data: { revision: 1, document },
  });
  expect(saved.status()).toBe(200);
  const { revision } = await saved.json();
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
      async () =>
        (await (await page.request.get(`/api/sites/${id}`)).json()).site
          .published_release_id,
      { timeout: 60000 },
    )
    .toBeTruthy();
  expect((await page.request.get(`/portfolio/${slug}`)).status()).toBe(200);
  await page.goto(`/studio/portfolios/${id}`);
  await page
    .getByRole("button", { name: "Delete portfolio", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog", { name: "Delete portfolio?" });
  await expect(dialog.getByText(/This portfolio is live/)).toBeVisible();
  await dialog.getByLabel(`Type ${slug} to confirm deletion`).fill(slug);
  await dialog
    .getByRole("button", { name: "Permanently delete portfolio" })
    .click();
  await expect(page).toHaveURL(/\/studio\/portfolios$/);
  expect((await page.request.get(`/api/sites/${id}`)).status()).toBe(404);
  expect((await page.request.get(`/portfolio/${slug}`)).status()).toBe(404);
});
